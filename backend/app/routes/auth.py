from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.customer import Customer
from ..schemas.user import UserCreate, UserResponse, Token
from ..services.auth import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        if db_user.status == "Active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        else:
            # Reactivate soft-deactivated staff member
            db_user.password_hash = get_password_hash(user_in.password)
            db_user.role = user_in.role
            db_user.status = "Active"
            db.commit()
            db.refresh(db_user)
            return db_user

    new_user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Check User table (Staff / Admin)
    user = db.query(User).filter(User.username == form_data.username, User.status == "Active").first()
    if user and verify_password(form_data.password, user.password_hash):
        access_token = create_access_token(data={"sub": user.username, "role": user.role})
        return {"access_token": access_token, "token_type": "bearer"}

    # 2. Check Customer table (portal credentials)
    customer = db.query(Customer).filter(Customer.portal_username == form_data.username, Customer.status == "Active").first()
    if customer:
        if customer.portal_status != "Allowed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Portal access is blocked by administrator.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if customer.portal_password_hash and verify_password(form_data.password, customer.portal_password_hash):
            access_token = create_access_token(data={"sub": customer.portal_username, "role": "Customer"})
            return {"access_token": access_token, "token_type": "bearer"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

from ..dependencies.auth import get_current_user
from typing import List, Optional

@router.get("/users", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view the staff directory.")
    return db.query(User).filter(User.status == "Active").all()

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete staff accounts.")
    
    user_to_delete = db.query(User).filter(User.id == user_id, User.status == "Active").first()
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
    if user_to_delete.username == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System default admin cannot be deleted.")

    # Soft deactivation
    user_to_delete.status = "Inactive"
    db.commit()
    return {"message": "Staff member deactivated successfully."}

class UserUpdate(BaseModel):
    username: str
    password: Optional[str] = None
    role: str

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can edit user accounts.")

    user = db.query(User).filter(User.id == user_id, User.status == "Active").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Check username uniqueness if changed
    if user_in.username != user.username:
        exists = db.query(User).filter(User.username == user_in.username, User.status == "Active").first()
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken.")
        user.username = user_in.username

    if user_in.password:
        user.password_hash = get_password_hash(user_in.password)

    # Prevent changing role of default admin
    if user.username != "admin":
        user.role = user_in.role

    db.commit()
    db.refresh(user)
    return user
