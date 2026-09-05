import re
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..models.bill import Bill, FinancialYearCounter

def reset_table_sequence(db: Session, table_name: str, id_column: str = "id"):
    """
    Resets the database auto-increment sequence / counter for a table
    so that IDs do not drift or create large gaps when records are deleted.
    Supports both PostgreSQL and SQLite.
    """
    try:
        if not db.bind:
            return
        dialect = db.bind.dialect.name
        if dialect == "postgresql":
            db.execute(text(f"""
                SELECT setval(
                    COALESCE(pg_get_serial_sequence('{table_name}', '{id_column}'), '{table_name}_{id_column}_seq'),
                    COALESCE((SELECT MAX({id_column}) FROM {table_name}), 0) + 1,
                    false
                )
            """))
        elif dialect == "sqlite":
            db.execute(text(f"""
                UPDATE sqlite_sequence 
                SET seq = (SELECT COALESCE(MAX({id_column}), 0) FROM {table_name}) 
                WHERE name = '{table_name}'
            """))
    except Exception as e:
        # Ignore sequence reset errors on dialects/tables where sequence table does not exist
        pass

def sync_financial_year_counters(db: Session):
    """
    Reconciles all FinancialYearCounter records with actual existing bills in the database.
    If all bills for an FY have been deleted, last_number resets to 0.
    Otherwise, last_number reflects the maximum existing bill number.
    """
    try:
        counters = db.query(FinancialYearCounter).all()
        for counter in counters:
            fy = counter.financial_year
            # Determine short_fy e.g. "2026-2027" -> "26-27"
            parts = fy.split("-")
            if len(parts) == 2:
                short_fy = f"{parts[0][-2:]}-{parts[1][-2:]}"
            else:
                short_fy = fy

            bills = db.query(Bill.bill_no).filter(Bill.bill_no.like(f"GT/{short_fy}/%")).all()
            max_num = 0
            for (b_no,) in bills:
                match = re.search(r"/(\d+)$", b_no)
                if match:
                    max_num = max(max_num, int(match.group(1)))
            
            counter.last_number = max_num
        db.flush()
    except Exception as e:
        pass
