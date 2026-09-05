import unittest
from decimal import Decimal
from backend.app.services.billing_calculator import (
    calculate_bill, ItemCalculationInput, round_half_up
)

class TestBillingCalculator(unittest.TestCase):

    def test_round_half_up(self):
        self.assertEqual(round_half_up(Decimal("100.5")), 101)
        self.assertEqual(round_half_up(Decimal("100.4")), 100)
        self.assertEqual(round_half_up(Decimal("100.49")), 100)
        self.assertEqual(round_half_up(Decimal("100.50")), 101)

    def test_whole_rupee_bill_zero_drift(self):
        # 2 items, round amounts, 0% tax
        items = [
            ItemCalculationInput(
                product_name="Wheat 10kg",
                qty=Decimal("1"),
                sale_price=Decimal("250.00"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            ),
            ItemCalculationInput(
                product_name="Rice 5kg",
                qty=Decimal("2"),
                sale_price=Decimal("150.00"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            )
        ]
        result = calculate_bill(items)
        self.assertEqual(result.subtotal_paise, 55000)  # 250 + 300 = 550
        self.assertEqual(result.tax_paise, 0)
        self.assertEqual(result.round_off_paise, 0)
        self.assertEqual(result.grand_total_paise, 55000)
        self.assertEqual(result.grand_total, Decimal("550.00"))

    def test_tax_inclusive_mrp_back_calculation(self):
        # Item MRP 105, 5% tax inclusive.
        # Taxable base = 105 * 100 / 105 = 100.00 (10000 paise).
        # Tax = 5.00 (500 paise), split into CGST 2.50 (250 paise) and SGST 2.50 (250 paise).
        items = [
            ItemCalculationInput(
                product_name="Mustard Oil 1L",
                qty=Decimal("1"),
                sale_price=Decimal("105.00"),
                mrp=Decimal("105.00"),
                tax_rate=Decimal("5.00"),
                is_tax_inclusive=True
            )
        ]
        result = calculate_bill(items, is_interstate=False)
        self.assertEqual(result.items[0].taxable_paise, 10000)
        self.assertEqual(result.items[0].tax_paise, 500)
        self.assertEqual(result.items[0].cgst_paise, 250)
        self.assertEqual(result.items[0].sgst_paise, 250)
        self.assertEqual(result.items[0].igst_paise, 0)
        self.assertEqual(result.grand_total_paise, 10500)
        self.assertEqual(result.round_off_paise, 0)

    def test_mixed_tax_slabs(self):
        # Item A: 0% tax (Grains), ₹100
        # Item B: 5% tax inclusive (Oil), ₹105 (taxable 100, tax 5)
        # Item C: 18% tax inclusive (Soap), ₹118 (taxable 100, tax 18)
        items = [
            ItemCalculationInput(
                product_name="Wheat",
                qty=Decimal("1"),
                sale_price=Decimal("100.00"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            ),
            ItemCalculationInput(
                product_name="Oil",
                qty=Decimal("1"),
                sale_price=Decimal("105.00"),
                tax_rate=Decimal("5.00"),
                is_tax_inclusive=True
            ),
            ItemCalculationInput(
                product_name="Soap",
                qty=Decimal("1"),
                sale_price=Decimal("118.00"),
                tax_rate=Decimal("18.00"),
                is_tax_inclusive=True
            ),
        ]
        result = calculate_bill(items, is_interstate=False)
        self.assertEqual(result.grand_total_paise, 32300)
        self.assertEqual(len(result.tax_slabs), 3)
        
        slabs_by_rate = {s.tax_rate: s for s in result.tax_slabs}
        self.assertEqual(slabs_by_rate[Decimal("0.00")].taxable_paise, 10000)
        self.assertEqual(slabs_by_rate[Decimal("0.00")].tax_paise, 0)
        
        self.assertEqual(slabs_by_rate[Decimal("5.00")].taxable_paise, 10000)
        self.assertEqual(slabs_by_rate[Decimal("5.00")].cgst_paise, 250)
        self.assertEqual(slabs_by_rate[Decimal("5.00")].sgst_paise, 250)
        
        self.assertEqual(slabs_by_rate[Decimal("18.00")].taxable_paise, 10000)
        self.assertEqual(slabs_by_rate[Decimal("18.00")].cgst_paise, 900)
        self.assertEqual(slabs_by_rate[Decimal("18.00")].sgst_paise, 900)

    def test_interstate_igst(self):
        items = [
            ItemCalculationInput(
                product_name="Soap",
                qty=Decimal("1"),
                sale_price=Decimal("118.00"),
                tax_rate=Decimal("18.00"),
                is_tax_inclusive=True
            )
        ]
        result = calculate_bill(items, is_interstate=True)
        self.assertEqual(result.cgst_paise, 0)
        self.assertEqual(result.sgst_paise, 0)
        self.assertEqual(result.igst_paise, 1800)
        self.assertEqual(result.tax_paise, 1800)

    def test_round_off_adjustments(self):
        # Case A: Negative round-off (₹104.30 -> ₹104.00, round_off = -0.30)
        items_a = [
            ItemCalculationInput(
                product_name="Item A",
                qty=Decimal("1"),
                sale_price=Decimal("104.30"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            )
        ]
        res_a = calculate_bill(items_a)
        self.assertEqual(res_a.raw_total_paise, 10430)
        self.assertEqual(res_a.round_off_paise, -30)
        self.assertEqual(res_a.grand_total_paise, 10400)
        self.assertEqual(res_a.grand_total, Decimal("104.00"))
        self.assertEqual(res_a.round_off, Decimal("-0.30"))

        # Case B: Positive round-off (₹104.70 -> ₹105.00, round_off = +0.30)
        items_b = [
            ItemCalculationInput(
                product_name="Item B",
                qty=Decimal("1"),
                sale_price=Decimal("104.70"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            )
        ]
        res_b = calculate_bill(items_b)
        self.assertEqual(res_b.raw_total_paise, 10470)
        self.assertEqual(res_b.round_off_paise, 30)
        self.assertEqual(res_b.grand_total_paise, 10500)
        self.assertEqual(res_b.grand_total, Decimal("105.00"))
        self.assertEqual(res_b.round_off, Decimal("0.30"))

    def test_proportional_bill_discount_distribution(self):
        # 2 items of ₹100 each. Flat bill discount ₹20.
        # Each item should receive ₹10 (1000 paise) discount.
        items = [
            ItemCalculationInput(
                product_name="Item 1",
                qty=Decimal("1"),
                sale_price=Decimal("100.00"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            ),
            ItemCalculationInput(
                product_name="Item 2",
                qty=Decimal("1"),
                sale_price=Decimal("100.00"),
                tax_rate=Decimal("0.00"),
                is_tax_inclusive=True
            )
        ]
        res = calculate_bill(items, bill_discount_rupees=Decimal("20.00"))
        self.assertEqual(res.items[0].allocated_bill_discount_paise, 1000)
        self.assertEqual(res.items[1].allocated_bill_discount_paise, 1000)
        self.assertEqual(res.grand_total_paise, 18000)
        self.assertEqual(res.grand_total, Decimal("180.00"))

if __name__ == "__main__":
    unittest.main()
