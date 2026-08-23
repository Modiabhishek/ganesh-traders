import json
import urllib.request
import urllib.parse
from decimal import Decimal

BASE_URL = "http://localhost:8000/api"

def make_request(path, method="GET", data=None, token=None, content_type="application/json"):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req_data = None
    if data:
        if content_type == "application/json":
            req_data = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif content_type == "application/x-www-form-urlencoded":
            req_data = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8")), res.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code}: {body}")
        raise e

def run_usability_test():
    print("=" * 60)
    print("STARTING REAL-WORLD BUSINESS USABILITY TEST...")
    print("=" * 60)
    
    # 1. Login
    print("\n[Step 1] Logging in as Admin...")
    login_data = {"username": "admin", "password": "adminpass"}
    res, status = make_request("/auth/login", "POST", login_data, content_type="application/x-www-form-urlencoded")
    assert status == 200
    token = res["access_token"]
    print("Login successful! Token acquired.")
    
    # 2. Get Categories & Seed Product
    print("\n[Step 2] Retrieving categories & creating test product...")
    cats, _ = make_request("/products/categories", "GET", token=token)
    grocery_cat = cats[0] # "Grocery / Daily Needs"
    print(f"Using category: {grocery_cat['name']} (ID: {grocery_cat['id']})")
    
    prod_data = {
        "name": "Basmati Rice 5kg",
        "category_id": grocery_cat["id"],
        "brand": "India Gate",
        "unit": "packet",
        "pack_size": "5 kg",
        "purchase_price": 450.00,
        "selling_price": 550.00,
        "minimum_stock": 5.00,
        "notes": "Premium long grain rice"
    }
    prod, _ = make_request("/products/", "POST", prod_data, token=token)
    print(f"Created Product: {prod['name']} | Code: {prod['product_code']} | Price: Rs. {prod['selling_price']}")
    
    # 3. Simulate CSV Customer Import
    print("\n[Step 3] Importing customer data from CSV...")
    import_rows = [
        {
            "name": "Ramesh Kumar",
            "mobile": "9876543210",
            "address": "123 Main St",
            "customer_type": "Retail",
            "payment_type": "Monthly Credit",
            "opening_balance": 7500.00,
            "credit_limit": 15000.00,
            "notes": "Migrated from Old Ledger Book"
        },
        {
            "name": "Suresh Sharma",
            "mobile": "9823456789",
            "address": "456 Park Rd",
            "customer_type": "Wholesale",
            "payment_type": "Monthly Credit",
            "opening_balance": 12000.00,
            "credit_limit": 50000.00,
            "notes": "Main wholesale distributor"
        },
        {
            "name": "Mahesh Singh",
            "mobile": "9812345678",
            "address": "789 Lake View",
            "customer_type": "Retail",
            "payment_type": "Cash",
            "opening_balance": 0.00,
            "credit_limit": 0.00,
            "notes": "Cash buyer"
        }
    ]
    import_res, _ = make_request("/customers/import-confirm", "POST", import_rows, token=token)
    print(import_res["message"])
    
    # 4. Search Customer
    print("\n[Step 4] Searching for Ramesh Kumar in database...")
    custs, _ = make_request("/customers/?search=Ramesh", "GET", token=token)
    ramesh = custs[0]
    print(f"Found Customer: {ramesh['name']} | Code: {ramesh['customer_code']} | Opening Due: Rs. {ramesh['opening_balance']} | Current Outstanding: Rs. {ramesh['current_balance']}")
    
    # 5. Create Credit Sale with Partial Payment
    # Ramesh buys 2 bags of Basmati Rice (2 * 550 = Rs. 1100). Pays Rs. 300 cash immediately.
    # Remaining due = Rs. 800. Expected outstanding = 7500 (opening) + 800 = Rs. 8300.
    print("\n[Step 5] Creating credit sale for Ramesh Kumar (Rice 5kg x2)...")
    sale_data = {
        "customer_id": ramesh["id"],
        "items": [
            {"product_id": prod["id"], "quantity": 2, "price": 550.00}
        ],
        "discount": 0.00,
        "paid_amount": 300.00,
        "payment_method": "Credit"
    }
    sale, _ = make_request("/transactions/sales", "POST", sale_data, token=token)
    print(f"Sale Recorded: {sale['sale_number']} | Bill Total: Rs. {sale['total_amount']} | Paid: Rs. {sale['paid_amount']} | Due: Rs. {sale['due_amount']}")
    
    # Verify Customer outstanding
    ramesh_updated, _ = make_request(f"/customers/{ramesh['id']}", "GET", token=token)
    print(f"Ramesh Updated Outstanding: Rs. {ramesh_updated['current_balance']} (Expected: Rs. 8300.00)")
    assert float(ramesh_updated['current_balance']) == 8300.00
    
    # 6. Receive Customer Payment
    # Ramesh pays Rs. 2300 towards his outstanding dues
    # Expected outstanding = 8300 - 2300 = Rs. 6000.
    print("\n[Step 6] Collecting payment from Ramesh Kumar...")
    payment_data = {
        "customer_id": ramesh["id"],
        "amount": 2300.00,
        "payment_method": "UPI",
        "reference_number": "TXN987654",
        "notes": "Part payment via PhonePe"
    }
    payment, _ = make_request("/transactions/payments", "POST", payment_data, token=token)
    print(f"Payment Recorded: {payment['payment_number']} | Amount Collected: Rs. {payment['amount']}")
    
    # Verify final balance
    ramesh_final, _ = make_request(f"/customers/{ramesh['id']}", "GET", token=token)
    print(f"Ramesh Final Outstanding Balance: Rs. {ramesh_final['current_balance']} (Expected: Rs. 6000.00)")
    assert float(ramesh_final['current_balance']) == 6000.00
    
    # 7. Print Ledger Statement
    print("\n[Step 7] Extracting Customer Ledger Statement...")
    ledger_statement, _ = make_request(f"/customers/{ramesh['id']}/ledger", "GET", token=token)
    print(f"\n--- LEDGER STATEMENT FOR: {ledger_statement['customer']['name']} ({ledger_statement['customer']['customer_code']}) ---")
    print(f"{'Date':<22} | {'Type':<15} | {'Reference':<12} | {'Debit (Bought)':<15} | {'Credit (Paid)':<15} | {'Running Due':<15}")
    print("-" * 110)
    for entry in ledger_statement["ledger"]:
        print(f"{entry['date']:<22} | {entry['type']:<15} | {entry['reference']:<12} | {entry['debit']:<15} | {entry['credit']:<15} | {entry['running_balance']:<15}")
        
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! GO-LIVE WORKFLOW CONFIRMED.")
    print("=" * 60)

if __name__ == "__main__":
    run_usability_test()
