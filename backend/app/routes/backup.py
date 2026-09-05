import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies.auth import get_admin_user
from ..models.user import User
from ..models.customer import Customer, LiveUpdate
from ..models.product import Product, Category
from ..models.transaction import Sale, SaleItem, CustomerPayment, Expense, CerealTransaction
from ..models.inventory import StockMovement

router = APIRouter(prefix='/backup', tags=['backup'])

@router.get('/export')
def export_full_backup(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    now_str = datetime.utcnow().strftime('%Y-%m-%d_%H%M%S')
    
    customers = db.query(Customer).all()
    products = db.query(Product).all()
    categories = db.query(Category).all()
    sales = db.query(Sale).all()
    sale_items = db.query(SaleItem).all()
    payments = db.query(CustomerPayment).all()
    expenses = db.query(Expense).all()
    cereal_txs = db.query(CerealTransaction).all()
    stock_movements = db.query(StockMovement).all()
    live_updates = db.query(LiveUpdate).all()

    backup_data = {
        'backup_version': '1.0',
        'exported_at_utc': datetime.utcnow().isoformat(),
        'business_name': 'Ganesh Traders',
        'exported_by_admin': admin_user.username,
        'record_counts': {
            'customers': len(customers),
            'products': len(products),
            'categories': len(categories),
            'sales': len(sales),
            'sale_items': len(sale_items),
            'customer_payments': len(payments),
            'expenses': len(expenses),
            'cereal_transactions': len(cereal_txs),
            'stock_movements': len(stock_movements),
            'live_updates': len(live_updates)
        },
        'data': {
            'categories': [
                {
                    'id': c.id, 
                    'name': c.name, 
                    'description': c.description
                } for c in categories
            ],
            'products': [
                {
                    'id': p.id,
                    'product_code': p.product_code,
                    'name': p.name,
                    'category_id': p.category_id,
                    'selling_price': float(p.selling_price) if p.selling_price is not None else 0.0,
                    'unit': p.unit,
                    'current_stock': float(p.current_stock) if p.current_stock is not None else 0.0
                } for p in products
            ],
            'customers': [
                {
                    'id': c.id,
                    'customer_code': c.customer_code,
                    'name': c.name,
                    'fathers_name': c.fathers_name,
                    'reference': c.reference,
                    'mobile': c.mobile,
                    'address': c.address,
                    'customer_type': c.customer_type,
                    'payment_type': c.payment_type,
                    'opening_balance': float(c.opening_balance) if c.opening_balance is not None else 0.0,
                    'current_balance': float(c.current_balance) if c.current_balance is not None else 0.0,
                    'credit_limit': float(c.credit_limit) if c.credit_limit is not None else 0.0,
                    'notes': c.notes,
                    'status': c.status,
                    'portal_username': c.portal_username,
                    'portal_status': c.portal_status,
                    'created_at': c.created_at.isoformat() if c.created_at else None
                } for c in customers
            ],
            'sales': [
                {
                    'id': s.id,
                    'invoice_number': s.invoice_number,
                    'customer_id': s.customer_id,
                    'total_amount': float(s.total_amount) if s.total_amount is not None else 0.0,
                    'paid_amount': float(s.paid_amount) if s.paid_amount is not None else 0.0,
                    'payment_status': s.payment_status,
                    'notes': s.notes,
                    'date': s.date.isoformat() if s.date else None
                } for s in sales
            ],
            'sale_items': [
                {
                    'id': si.id,
                    'sale_id': si.sale_id,
                    'product_id': si.product_id,
                    'quantity': float(si.quantity) if si.quantity is not None else 0.0,
                    'unit_price': float(si.unit_price) if si.unit_price is not None else 0.0,
                    'subtotal': float(si.subtotal) if si.subtotal is not None else 0.0
                } for si in sale_items
            ],
            'customer_payments': [
                {
                    'id': p.id,
                    'customer_id': p.customer_id,
                    'amount': float(p.amount) if p.amount is not None else 0.0,
                    'payment_mode': p.payment_mode,
                    'reference_number': p.reference_number,
                    'notes': p.notes,
                    'payment_date': p.payment_date.isoformat() if p.payment_date else None
                } for p in payments
            ],
            'expenses': [
                {
                    'id': e.id,
                    'category': e.category,
                    'title': e.title,
                    'amount': float(e.amount) if e.amount is not None else 0.0,
                    'payment_mode': e.payment_mode,
                    'notes': e.notes,
                    'expense_date': e.expense_date.isoformat() if e.expense_date else None
                } for e in expenses
            ],
            'cereal_transactions': [
                {
                    'id': ct.id,
                    'trade_type': ct.trade_type,
                    'party_name': ct.party_name,
                    'cereal_name': ct.cereal_name,
                    'weight_quintals': float(ct.weight_quintals) if ct.weight_quintals is not None else 0.0,
                    'rate_per_quintal': float(ct.rate_per_quintal) if ct.rate_per_quintal is not None else 0.0,
                    'total_amount': float(ct.total_amount) if ct.total_amount is not None else 0.0,
                    'settlement_status': ct.settlement_status,
                    'vehicle_number': ct.vehicle_number,
                    'notes': ct.notes,
                    'date': ct.date.isoformat() if ct.date else None
                } for ct in cereal_txs
            ],
            'live_updates': [
                {
                    'id': lu.id,
                    'title': lu.title,
                    'content': lu.content,
                    'published_at': lu.published_at.isoformat() if lu.published_at else None
                } for lu in live_updates
            ]
        }
    }

    content_str = json.dumps(backup_data, indent=2, ensure_ascii=False)
    filename = 'ganesh_traders_full_backup_' + now_str + '.json'
    
    return Response(
        content=content_str,
        media_type='application/json',
        headers={
            'Content-Disposition': f'attachment; filename={filename}'
        }
    )
