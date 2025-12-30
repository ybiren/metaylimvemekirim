import platform
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SYSTEM = platform.system()  # 'Windows', 'Linux', 'Darwin'
if SYSTEM == "Windows": #dev
    DATABASE_URL = "postgresql://postgres:StrongPass123!@127.0.0.1:15433/metaylim"
elif SYSTEM == "Linux": #prod
    DATABASE_URL = "postgresql://postgres:StrongPass123!@127.0.0.1:5433/metaylim"
else:
    raise RuntimeError(f"Unsupported OS: {SYSTEM}")

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
