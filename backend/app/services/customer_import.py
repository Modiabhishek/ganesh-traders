import io
import pandas as pd
from typing import List
from decimal import Decimal
from sqlalchemy.orm import Session
from ..models.customer import Customer
from ..schemas.customer import CustomerImportRow, CustomerImportPreview

def clean_phone(val) -> str:
    if pd.isna(val):
        return ""
    # Strip any decimal points if Excel read it as float
    s = str(val).strip().split('.')[0]
    # Keep only digits
    s = "".join([c for c in s if c.isdigit()])
    if len(s) == 10:
        return s
    return ""

def clean_str(val) -> str:
    if pd.isna(val):
        return ""
    return str(val).strip()

def clean_address_fuzzy(addr: str) -> str:
    s = addr.lower().strip()
    s = s.replace("street", "st").replace("road", "rd").replace(".", "")
    return s

def parse_csv_for_preview(csv_bytes: bytes, db: Session) -> CustomerImportPreview:
    df = pd.read_csv(io.BytesIO(csv_bytes))

    # Standardize column header mappings
    col_mapping = {
        "customer name": "name", "name": "name", "customer_name": "name",
        "mobile": "mobile", "phone": "mobile", "mobile number": "mobile", "mobile_number": "mobile",
        "address": "address",
        "customer type": "customer_type", "type": "customer_type", "customer_type": "customer_type",
        "payment type": "payment_type", "payment": "payment_type", "payment_type": "payment_type",
        "opening balance": "opening_balance", "opening_balance": "opening_balance", "opening due": "opening_balance",
        "credit limit": "credit_limit", "credit_limit": "credit_limit",
        "notes": "notes"
    }

    # Rename existing matching headers
    renamed = {}
    for col in df.columns:
        clean_col = col.lower().strip()
        if clean_col in col_mapping:
            renamed[col] = col_mapping[clean_col]
    df = df.rename(columns=renamed)

    # Ensure essential columns exist in the DataFrame
    for col in ["name", "mobile", "address", "customer_type", "payment_type", "opening_balance", "credit_limit", "notes"]:
        if col not in df.columns:
            df[col] = None

    rows = []
    seen_mobiles = {}       # mobile -> row_index
    seen_names = {}         # name -> row_index
    seen_name_addresses = {} # (name, address) -> row_index

    # Fetch existing active customers from the database for cross-referencing
    db_customers = db.query(Customer).filter(Customer.status == "Active").all()
    db_mobiles = {c.mobile: c for c in db_customers if c.mobile}
    db_names = {c.name.strip().lower(): c for c in db_customers}
    db_name_addresses = {(c.name.strip().lower(), clean_address_fuzzy(c.address or "")): c for c in db_customers}

    total_rows = len(df)
    valid_count = 0
    warning_count = 0
    error_count = 0
    duplicate_count = 0

    for idx, r in df.iterrows():
        row_idx = idx + 1
        name = clean_str(r.get("name"))
        mobile = clean_phone(r.get("mobile"))
        address = clean_str(r.get("address"))
        cust_type = clean_str(r.get("customer_type")) or "Retail"
        pay_type = clean_str(r.get("payment_type")) or "Cash"
        notes = clean_str(r.get("notes"))

        try:
            op_bal = Decimal(str(r.get("opening_balance") or 0.0)).quantize(Decimal("0.01"))
        except Exception:
            op_bal = Decimal("0.00")

        try:
            cr_lim = Decimal(str(r.get("credit_limit") or 0.0)).quantize(Decimal("0.01"))
        except Exception:
            cr_lim = Decimal("0.00")

        errors = []
        warnings = []
        is_duplicate = False
        duplicate_reason = None

        # 1. Base Validations
        if not name:
            errors.append("Customer name is required.")

        orig_mobile = str(r.get("mobile") or "").strip()
        if orig_mobile and not mobile:
            warnings.append(f"Mobile '{orig_mobile}' is invalid (must be 10 digits).")
        elif not mobile:
            warnings.append("Mobile number is missing.")

        # Customer & Payment Type Standardizations
        if cust_type.lower() in ["retail", "retailer"]:
            cust_type = "Retail"
        elif cust_type.lower() in ["wholesale", "wholesaler"]:
            cust_type = "Wholesale"
        else:
            cust_type = "Retail"

        if pay_type.lower() in ["cash", "cash customer"]:
            pay_type = "Cash"
        elif pay_type.lower() in ["credit", "monthly credit", "monthly-credit"]:
            pay_type = "Monthly Credit"
        else:
            pay_type = "Cash"

        # 2. Duplicate Detections
        name_clean = name.strip().lower()
        addr_clean = clean_address_fuzzy(address)

        if name:
            # Check against Database entries
            if mobile and mobile in db_mobiles:
                is_duplicate = True
                dup_cust = db_mobiles[mobile]
                duplicate_reason = f"Mobile {mobile} matches database customer '{dup_cust.name}' (Code: {dup_cust.customer_code})."
            elif (name_clean, addr_clean) in db_name_addresses:
                is_duplicate = True
                dup_cust = db_name_addresses[(name_clean, addr_clean)]
                duplicate_reason = f"Name and fuzzy address match database customer '{dup_cust.name}' (Code: {dup_cust.customer_code})."
            elif name_clean in db_names:
                warnings.append(f"Name matches database customer '{db_names[name_clean].name}' (Code: {db_names[name_clean].customer_code}).")

            # Check against earlier rows in the CSV
            if not is_duplicate:
                if mobile and mobile in seen_mobiles:
                    is_duplicate = True
                    dup_row = seen_mobiles[mobile]
                    duplicate_reason = f"Mobile {mobile} duplicate of row {dup_row} in CSV."
                elif (name_clean, addr_clean) in seen_name_addresses:
                    is_duplicate = True
                    dup_row = seen_name_addresses[(name_clean, addr_clean)]
                    duplicate_reason = f"Name + fuzzy address duplicate of row {dup_row} in CSV."
                elif name_clean in seen_names:
                    warnings.append(f"Name is a duplicate of row {seen_names[name_clean]} in CSV.")

            # Record occurrences of this row for subsequent rows checking
            if not is_duplicate:
                if mobile:
                    seen_mobiles[mobile] = row_idx
                seen_names[name_clean] = row_idx
                seen_name_addresses[(name_clean, addr_clean)] = row_idx

        if errors:
            error_count += 1
        elif is_duplicate:
            duplicate_count += 1
        elif warnings:
            warning_count += 1
            valid_count += 1
        else:
            valid_count += 1

        rows.append(CustomerImportRow(
            row_index=row_idx,
            name=name,
            mobile=mobile or None,
            address=address or None,
            customer_type=cust_type,
            payment_type=pay_type,
            opening_balance=op_bal,
            credit_limit=cr_lim,
            notes=notes or None,
            errors=errors,
            warnings=warnings,
            is_duplicate=is_duplicate,
            duplicate_reason=duplicate_reason
        ))

    return CustomerImportPreview(
        total_rows=total_rows,
        valid_count=valid_count,
        warning_count=warning_count,
        error_count=error_count,
        duplicate_count=duplicate_count,
        rows=rows
    )
