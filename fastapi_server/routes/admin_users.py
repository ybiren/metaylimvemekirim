# routes/admin_users.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc, asc
from db import get_db
from models.user import User

admin_users_router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

@admin_users_router.get("")
def admin_list_users(
    q: str | None = Query(None, description="Search text"),
    online: bool | None = Query(None, description="Only online users"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("created_at"),
    dir: str = Query("desc"),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    # search
    if q:
        qq = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.name).like(qq),
                func.lower(User.email).like(qq),
            )
        )

    # online filter (active in last 90 seconds)
    if online is True:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=90)
        query = query.filter(User.last_seen_at.isnot(None)).filter(User.last_seen_at >= cutoff)


    sort_map = {
        "created_at": User.created_at,
        "username": User.name,
        "email": User.email,
        "last_seen_at": User.last_seen_at,
        "status": "מוקפא" if User.isfreezed else "פעיל",
    }

    sort_col = sort_map.get(sort, User.created_at)
    order_fn = asc if dir == "asc" else desc
    query = query.order_by(order_fn(sort_col))

    total = query.count()
    items = (
        query.offset((page - 1) * page_size)
             .limit(page_size)
             .all()
    )

    return {
        "items": [
            {
                "id": u.id,
                "username": u.name,
                "email": u.email,
                "display_name": getattr(u, "display_name", None),
                "created_at": u.created_at,
                "last_seen_at": u.last_seen_at,
                "isfreezed": u.isfreezed,
                "status": "מוקפא" if u.isfreezed else "פעיל",
            }
            for u in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
