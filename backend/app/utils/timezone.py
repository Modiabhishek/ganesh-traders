from datetime import datetime as dt, timezone, timedelta

# Indian Standard Time (UTC+05:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> dt:
    """Returns current datetime in Indian Standard Time (IST) with tzinfo."""
    return dt.now(IST)

def get_ist_naive() -> dt:
    """
    Returns current datetime in Indian Standard Time (IST) as a naive datetime.
    Ensures that regardless of whether the server is running on Render (UTC)
    or locally in India, all database timestamps are recorded in exact IST.
    """
    return dt.now(IST).replace(tzinfo=None)
