from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models.user import User
from ..models.customer import Customer
from ..schemas.user import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == token_data.username, User.status == "Active").first()
    if user is None:
        customer = db.query(Customer).filter(Customer.portal_username == token_data.username, Customer.portal_status == "Allowed", Customer.status == "Active").first()
        if customer is None:
            raise credentials_exception
        
        class AuthUser:
            def __init__(self, id, username, role):
                self.id = id
                self.username = username
                self.role = role
                self.status = "Active"
        return AuthUser(id=customer.id, username=customer.portal_username, role="Customer")
    return user

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permissions are required for this action."
        )
    return current_user
