from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

def round_half_up(val: Decimal) -> int:
    """Rounds a Decimal value to the nearest integer using standard commercial half-up rounding."""
    return int(val.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

class ItemCalculationInput(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    barcode: Optional[str] = None
    hsn_code: Optional[str] = None
    unit: str = "piece"
    qty: Decimal = Decimal("1.000")
    mrp: Decimal = Decimal("0.00")
    sale_price: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")  # 0.00, 5.00, 12.00, 18.00, 28.00
    is_tax_inclusive: bool = True
    discount_pct: Decimal = Decimal("0.00")
    discount_amt: Decimal = Decimal("0.00")

class LineItemCalculated(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    barcode: Optional[str] = None
    hsn_code: Optional[str] = None
    unit: str = "piece"
    qty: Decimal
    mrp_paise: int
    sale_price_paise: int
    gross_paise: int
    line_discount_paise: int
    allocated_bill_discount_paise: int
    taxable_paise: int
    tax_rate: Decimal
    is_tax_inclusive: bool
    cgst_rate: Decimal
    cgst_paise: int
    sgst_rate: Decimal
    sgst_paise: int
    igst_rate: Decimal
    igst_paise: int
    tax_paise: int
    line_total_paise: int
    
    # Rupee formatted representations for UI
    mrp: Decimal
    sale_price: Decimal
    gross_amount: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal

class TaxSlabSummary(BaseModel):
    tax_rate: Decimal
    taxable_paise: int
    cgst_paise: int
    sgst_paise: int
    igst_paise: int
    tax_paise: int
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tax_amount: Decimal

class BillCalculationResult(BaseModel):
    items: List[LineItemCalculated]
    subtotal_paise: int
    total_line_discount_paise: int
    bill_discount_paise: int
    total_discount_paise: int
    taxable_paise: int
    cgst_paise: int
    sgst_paise: int
    igst_paise: int
    tax_paise: int
    raw_total_paise: int
    round_off_paise: int
    grand_total_paise: int
    
    # In Rupees for display / storage convenience
    subtotal: Decimal
    total_discount: Decimal
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal
    round_off: Decimal
    grand_total: Decimal
    
    tax_slabs: List[TaxSlabSummary]

def calculate_bill(
    items: List[ItemCalculationInput],
    bill_discount_rupees: Decimal = Decimal("0.00"),
    is_interstate: bool = False
) -> BillCalculationResult:
    """
    Calculates line-by-line GST, discount distributions, tax slabs,
    and rupee round-off strictly in integer paise.
    Zero floating point drift.
    """
    bill_disc_paise = max(0, round_half_up(Decimal(str(bill_discount_rupees)) * Decimal("100")))
    
    # First pass: calculate gross, line discounts, and net line values
    intermediate_items = []
    total_net_line_paise = 0
    total_line_disc_paise = 0

    for item in items:
        qty = Decimal(str(item.qty))
        sale_price_paise = round_half_up(Decimal(str(item.sale_price)) * Decimal("100"))
        mrp_paise = round_half_up(Decimal(str(item.mrp)) * Decimal("100"))
        gross_paise = round_half_up(Decimal(sale_price_paise) * qty)
        
        # Line discount
        if item.discount_amt > Decimal("0.00"):
            line_disc_paise = round_half_up(Decimal(str(item.discount_amt)) * Decimal("100"))
        elif item.discount_pct > Decimal("0.00"):
            line_disc_paise = round_half_up((Decimal(gross_paise) * Decimal(str(item.discount_pct))) / Decimal("100"))
        else:
            line_disc_paise = 0
            
        line_disc_paise = min(gross_paise, max(0, line_disc_paise))
        net_line_paise = gross_paise - line_disc_paise
        
        total_line_disc_paise += line_disc_paise
        total_net_line_paise += net_line_paise
        
        intermediate_items.append({
            "input": item,
            "qty": qty,
            "mrp_paise": mrp_paise,
            "sale_price_paise": sale_price_paise,
            "gross_paise": gross_paise,
            "line_disc_paise": line_disc_paise,
            "net_line_paise": net_line_paise
        })

    # Proportional bill discount allocation
    bill_disc_to_allocate = min(bill_disc_paise, total_net_line_paise)
    allocated_sum = 0
    
    for idx, item_data in enumerate(intermediate_items):
        if total_net_line_paise > 0 and bill_disc_to_allocate > 0:
            if idx == len(intermediate_items) - 1:
                # Assign remaining to avoid 1-paisa drift
                item_bill_disc = bill_disc_to_allocate - allocated_sum
            else:
                share = (Decimal(item_data["net_line_paise"]) * Decimal(bill_disc_to_allocate)) / Decimal(total_net_line_paise)
                item_bill_disc = round_half_up(share)
                allocated_sum += item_bill_disc
        else:
            item_bill_disc = 0
            
        item_data["allocated_bill_disc_paise"] = item_bill_disc
        item_data["effective_paise"] = max(0, item_data["net_line_paise"] - item_bill_disc)

    # Second pass: compute taxable, taxes, line totals
    calculated_items: List[LineItemCalculated] = []
    slab_accumulator: Dict[Decimal, Dict[str, int]] = {}

    total_subtotal_paise = 0
    total_taxable_paise = 0
    total_cgst_paise = 0
    total_sgst_paise = 0
    total_igst_paise = 0
    total_tax_paise = 0
    raw_total_paise = 0

    for item_data in intermediate_items:
        inp: ItemCalculationInput = item_data["input"]
        tax_rate = Decimal(str(inp.tax_rate))
        eff_paise = item_data["effective_paise"]
        total_subtotal_paise += item_data["gross_paise"]

        if tax_rate <= Decimal("0.00"):
            taxable_paise = eff_paise
            tax_paise = 0
            cgst_paise = 0
            sgst_paise = 0
            igst_paise = 0
            cgst_rate = Decimal("0.00")
            sgst_rate = Decimal("0.00")
            igst_rate = Decimal("0.00")
            line_total_paise = eff_paise
        else:
            if inp.is_tax_inclusive:
                # Back-calculate base taxable value from inclusive price
                taxable_paise = round_half_up((Decimal(eff_paise) * Decimal("100")) / (Decimal("100") + tax_rate))
                tax_paise = eff_paise - taxable_paise
                line_total_paise = eff_paise
            else:
                taxable_paise = eff_paise
                tax_paise = round_half_up((Decimal(taxable_paise) * tax_rate) / Decimal("100"))
                line_total_paise = taxable_paise + tax_paise

            if is_interstate:
                igst_rate = tax_rate
                cgst_rate = Decimal("0.00")
                sgst_rate = Decimal("0.00")
                igst_paise = tax_paise
                cgst_paise = 0
                sgst_paise = 0
            else:
                igst_rate = Decimal("0.00")
                cgst_rate = tax_rate / Decimal("2")
                sgst_rate = tax_rate / Decimal("2")
                cgst_paise = round_half_up(Decimal(tax_paise) / Decimal("2"))
                sgst_paise = tax_paise - cgst_paise
                igst_paise = 0

        total_taxable_paise += taxable_paise
        total_cgst_paise += cgst_paise
        total_sgst_paise += sgst_paise
        total_igst_paise += igst_paise
        total_tax_paise += tax_paise
        raw_total_paise += line_total_paise

        # Accumulate tax slabs
        if tax_rate not in slab_accumulator:
            slab_accumulator[tax_rate] = {
                "taxable_paise": 0,
                "cgst_paise": 0,
                "sgst_paise": 0,
                "igst_paise": 0,
                "tax_paise": 0
            }
        slab_accumulator[tax_rate]["taxable_paise"] += taxable_paise
        slab_accumulator[tax_rate]["cgst_paise"] += cgst_paise
        slab_accumulator[tax_rate]["sgst_paise"] += sgst_paise
        slab_accumulator[tax_rate]["igst_paise"] += igst_paise
        slab_accumulator[tax_rate]["tax_paise"] += tax_paise

        calculated_items.append(LineItemCalculated(
            product_id=inp.product_id,
            product_name=inp.product_name,
            barcode=inp.barcode,
            hsn_code=inp.hsn_code,
            unit=inp.unit,
            qty=item_data["qty"],
            mrp_paise=item_data["mrp_paise"],
            sale_price_paise=item_data["sale_price_paise"],
            gross_paise=item_data["gross_paise"],
            line_discount_paise=item_data["line_disc_paise"],
            allocated_bill_discount_paise=item_data["allocated_bill_disc_paise"],
            taxable_paise=taxable_paise,
            tax_rate=tax_rate,
            is_tax_inclusive=inp.is_tax_inclusive,
            cgst_rate=cgst_rate,
            cgst_paise=cgst_paise,
            sgst_rate=sgst_rate,
            sgst_paise=sgst_paise,
            igst_rate=igst_rate,
            igst_paise=igst_paise,
            tax_paise=tax_paise,
            line_total_paise=line_total_paise,
            
            mrp=Decimal(item_data["mrp_paise"]) / Decimal("100"),
            sale_price=Decimal(item_data["sale_price_paise"]) / Decimal("100"),
            gross_amount=Decimal(item_data["gross_paise"]) / Decimal("100"),
            discount_amount=Decimal(item_data["line_disc_paise"] + item_data["allocated_bill_disc_paise"]) / Decimal("100"),
            taxable_amount=Decimal(taxable_paise) / Decimal("100"),
            cgst_amount=Decimal(cgst_paise) / Decimal("100"),
            sgst_amount=Decimal(sgst_paise) / Decimal("100"),
            igst_amount=Decimal(igst_paise) / Decimal("100"),
            tax_amount=Decimal(tax_paise) / Decimal("100"),
            line_total=Decimal(line_total_paise) / Decimal("100")
        ))

    # Round-off: round to nearest rupee
    rounded_rupees = round_half_up(Decimal(raw_total_paise) / Decimal("100"))
    grand_total_paise = rounded_rupees * 100
    round_off_paise = grand_total_paise - raw_total_paise

    # Build sorted tax slabs
    tax_slabs: List[TaxSlabSummary] = []
    for rate in sorted(slab_accumulator.keys()):
        data = slab_accumulator[rate]
        tax_slabs.append(TaxSlabSummary(
            tax_rate=rate,
            taxable_paise=data["taxable_paise"],
            cgst_paise=data["cgst_paise"],
            sgst_paise=data["sgst_paise"],
            igst_paise=data["igst_paise"],
            tax_paise=data["tax_paise"],
            taxable_amount=Decimal(data["taxable_paise"]) / Decimal("100"),
            cgst_amount=Decimal(data["cgst_paise"]) / Decimal("100"),
            sgst_amount=Decimal(data["sgst_paise"]) / Decimal("100"),
            igst_amount=Decimal(data["igst_paise"]) / Decimal("100"),
            tax_amount=Decimal(data["tax_paise"]) / Decimal("100")
        ))

    return BillCalculationResult(
        items=calculated_items,
        subtotal_paise=total_subtotal_paise,
        total_line_discount_paise=total_line_disc_paise,
        bill_discount_paise=bill_disc_to_allocate,
        total_discount_paise=total_line_disc_paise + bill_disc_to_allocate,
        taxable_paise=total_taxable_paise,
        cgst_paise=total_cgst_paise,
        sgst_paise=total_sgst_paise,
        igst_paise=total_igst_paise,
        tax_paise=total_tax_paise,
        raw_total_paise=raw_total_paise,
        round_off_paise=round_off_paise,
        grand_total_paise=grand_total_paise,
        
        subtotal=Decimal(total_subtotal_paise) / Decimal("100"),
        total_discount=Decimal(total_line_disc_paise + bill_disc_to_allocate) / Decimal("100"),
        taxable_amount=Decimal(total_taxable_paise) / Decimal("100"),
        cgst_amount=Decimal(total_cgst_paise) / Decimal("100"),
        sgst_amount=Decimal(total_sgst_paise) / Decimal("100"),
        igst_amount=Decimal(total_igst_paise) / Decimal("100"),
        total_tax_amount=Decimal(total_tax_paise) / Decimal("100"),
        round_off=Decimal(round_off_paise) / Decimal("100"),
        grand_total=Decimal(grand_total_paise) / Decimal("100"),
        
        tax_slabs=tax_slabs
    )
