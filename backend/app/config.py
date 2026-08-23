from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./business.db"
    SECRET_KEY: str = "d2a6a12b6f17e089201a09abfae6c6b3e648c66e2a9b34351f044efc4d1565bd" # Dev key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
