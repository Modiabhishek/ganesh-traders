import unittest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app, startup_event
from backend.app.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.customer import Customer
from backend.app.models.product import Product
from backend.app.services.auth import create_access_token

class TestPOSBillingIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        startup_event()
        cls.client = TestClient(app)
        
        # Get admin user and create token
        db = SessionLocal()
        admin = db.query(User).filter(User.role == "Admin").first()
        cls.admin_token = create_access_token(data={"sub": admin.username, "role": admin.role, "id": admin.id})
        cls.headers = {"Authorization": f"Bearer {cls.admin_token}"}
        db.close()

    def test_end_to_end_pos_flow(self):
        # 1. Look up existing product by barcode or code
        resp = self.client.get("/api/products/lookup-barcode/PROD-00002", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        prod_oil = resp.json()
        self.assertEqual(prod_oil["product_code"], "PROD-00002")

        # 2. Preview calculation via /api/bills/calculate
        calc_payload = {
            "items": [
                {
                    "product_id": prod_oil["id"],
                    "product_name": prod_oil["name"],
                    "barcode": prod_oil["barcode"],
                    "qty": 2.0,
                    "unit": "litre",
                    "mrp": float(prod_oil["mrp"] or prod_oil["selling_price"]),
                    "sale_price": float(prod_oil["selling_price"]),
                    "tax_rate": 5.0,
                    "is_tax_inclusive": True,
                    "discount_pct": 0,
                    "discount_amt": 0
                }
            ],
            "bill_discount": 10.0,
            "is_interstate": False
        }
        calc_resp = self.client.post("/api/bills/calculate", json=calc_payload, headers=self.headers)
        self.assertEqual(calc_resp.status_code, 200)
        calc_data = calc_resp.json()
        self.assertEqual(float(calc_data["subtotal"]), 360.0)
        self.assertEqual(float(calc_data["grand_total"]), 350.0)
        self.assertTrue(len(calc_data["tax_slabs"]) > 0)

        # 3. Create a customer to test credit sale and ledger sync
        cust_resp = self.client.post("/api/customers/", json={
            "name": "Integration Test Customer",
            "mobile": "9999988888",
            "customer_type": "Retail",
            "payment_type": "Monthly Credit",
            "opening_balance": 0.0,
            "credit_limit": 10000.0
        }, headers=self.headers)
        self.assertEqual(cust_resp.status_code, 201)
        cust_id = cust_resp.json()["id"]

        # 4. Finalize bill as a partial payment (Credit remaining)
        bill_payload = {
            "customer_id": cust_id,
            "items": calc_payload["items"],
            "payments": [
                {"mode": "Cash", "amount": 100.0}
            ],
            "bill_discount": 10.0,
            "is_interstate": False,
            "notes": "Test partial payment POS sale"
        }
        finalize_resp = self.client.post("/api/bills/finalize", json=bill_payload, headers=self.headers)
        self.assertEqual(finalize_resp.status_code, 201)
        bill = finalize_resp.json()
        self.assertTrue(bill["bill_no"].startswith("GT/"))
        self.assertEqual(bill["grand_total"], 350.0)
        self.assertEqual(bill["paid_amount"], 100.0)
        self.assertEqual(bill["due_amount"], 250.0)
        self.assertEqual(bill["payment_status"], "PARTIALLY PAID")

        # 5. Verify customer balance was updated to 250
        cust_check = self.client.get(f"/api/customers/{cust_id}", headers=self.headers).json()
        self.assertEqual(float(cust_check["current_balance"]), 250.0)

        # 6. Receive partial payment of 150 in customer ledger
        pmt_resp = self.client.post("/api/transactions/payments", json={
            "customer_id": cust_id,
            "amount": 150.0,
            "payment_method": "UPI",
            "notes": "Partial ledger payment"
        }, headers=self.headers)
        self.assertEqual(pmt_resp.status_code, 201)

        # Verify customer balance is now 100
        cust_check2 = self.client.get(f"/api/customers/{cust_id}", headers=self.headers).json()
        self.assertEqual(float(cust_check2["current_balance"]), 100.0)

        # Verify the matching sale now reflects remaining 100 due
        sales_resp = self.client.get(f"/api/transactions/sales?customer_id={cust_id}", headers=self.headers).json()
        self.assertEqual(len(sales_resp), 1)
        matching_sale = sales_resp[0]
        self.assertEqual(float(matching_sale["due_amount"]), 100.0)
        self.assertEqual(float(matching_sale["paid_amount"]), 250.0) # 100 counter + 150 ledger
        self.assertEqual(matching_sale["payment_status"], "PARTIALLY PAID")

        # 7. Receive final payment of 100 in customer ledger
        pmt_final = self.client.post("/api/transactions/payments", json={
            "customer_id": cust_id,
            "amount": 100.0,
            "payment_method": "Cash",
            "notes": "Settling remaining balance"
        }, headers=self.headers)
        self.assertEqual(pmt_final.status_code, 201)

        # Verify customer balance is 0.00 (not negative / in minus!)
        cust_check3 = self.client.get(f"/api/customers/{cust_id}", headers=self.headers).json()
        self.assertEqual(float(cust_check3["current_balance"]), 0.0)

        # Verify sale is now marked PAID with due 0.00!
        sales_resp2 = self.client.get(f"/api/transactions/sales?customer_id={cust_id}", headers=self.headers).json()
        matching_sale2 = sales_resp2[0]
        self.assertEqual(float(matching_sale2["due_amount"]), 0.0)
        self.assertEqual(float(matching_sale2["paid_amount"]), 350.0)
        self.assertEqual(matching_sale2["payment_status"], "PAID")

        # 8. Check ledger endpoint consistency
        ledger_resp = self.client.get(f"/api/customers/{cust_id}/ledger", headers=self.headers).json()
        self.assertEqual(float(ledger_resp["customer"]["current_balance"]), 0.0)
        last_ledger_row = ledger_resp["ledger"][-1]
        self.assertEqual(float(last_ledger_row["running_balance"]), 0.0)

        # Clean up customer and transactions
        db = SessionLocal()
        c = db.query(Customer).filter(Customer.id == cust_id).first()
        if c:
            c.status = "Inactive"
            db.commit()
        db.close()

if __name__ == "__main__":
    unittest.main()
