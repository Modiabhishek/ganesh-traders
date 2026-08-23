from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.product import Category, Product
from ..schemas.product import CategoryCreate, CategoryResponse, ProductCreate, ProductUpdate, ProductResponse
from ..dependencies.auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Category).filter(Category.status == "Active").all()

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category_in: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dup = db.query(Category).filter(Category.name.ilike(category_in.name)).first()
    if dup:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists.")
    new_cat = Category(name=category_in.name)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

def generate_product_code(db: Session) -> str:
    count = db.query(Product).count()
    return f"PROD-{count + 1:05d}"

@router.get("/", response_model=List[ProductResponse])
def get_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product).filter(Product.status == "Active")
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            Product.name.ilike(search_filter) |
            Product.product_code.ilike(search_filter) |
            Product.brand.ilike(search_filter)
        )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    return query.all()

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == product_in.category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    code = generate_product_code(db)
    new_prod = Product(
        product_code=code,
        name=product_in.name,
        category_id=product_in.category_id,
        brand=product_in.brand,
        unit=product_in.unit,
        pack_size=product_in.pack_size,
        purchase_price=product_in.purchase_price,
        selling_price=product_in.selling_price,
        minimum_stock=product_in.minimum_stock,
        current_stock=0.00,
        notes=product_in.notes
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)
    return new_prod

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prod = db.query(Product).filter(Product.id == product_id, Product.status == "Active").first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    update_data = product_in.dict(exclude_unset=True)
    
    if "category_id" in update_data:
        cat = db.query(Category).filter(Category.id == update_data["category_id"]).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    for field, value in update_data.items():
        setattr(prod, field, value)

    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/{product_id}", status_code=status.HTTP_200_OK)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prod = db.query(Product).filter(Product.id == product_id, Product.status == "Active").first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    prod.status = "Inactive"
    db.commit()
    return {"message": "Product deactivated successfully."}
