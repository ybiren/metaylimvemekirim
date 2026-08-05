# routes/admin_reports.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc, asc
from db import get_db
from models.user_report import UserReport
from models.user import User

admin_reports_router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])


@admin_reports_router.get("")
def admin_list_reports(
    q: str | None = Query(None, description="Search text"),
    user_id: int | None = Query(None, description="Only reports on this profile"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("created_at"),
    dir: str = Query("desc"),
    db: Session = Depends(get_db),
):
    query = db.query(UserReport)

    # search
    if q:
        qq = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(UserReport.subject).like(qq),
                func.lower(UserReport.content).like(qq),
            )
        )

    if user_id is not None:
        query = query.filter(UserReport.user_id == user_id)

    sort_map = {
        "created_at": UserReport.created_at,
        "id": UserReport.id,
        "user_id": UserReport.user_id,
        "subject": UserReport.subject,
    }

    sort_col = sort_map.get(sort, UserReport.created_at)
    order_fn = asc if dir == "asc" else desc
    query = query.order_by(order_fn(sort_col))

    total = query.count()
    items = (
        query.offset((page - 1) * page_size)
             .limit(page_size)
             .all()
    )

    # The reported profile's name is not copied into the row, so resolve the
    # names for this page in one query rather than per row.
    names: dict[int, str | None] = {}
    ids = {r.user_id for r in items}
    if ids:
        names = {
            uid: name
            for uid, name in db.query(User.id, User.name).filter(User.id.in_(ids)).all()
        }

    return {
        "items": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "user_name": names.get(r.user_id),
                "subject": r.subject,
                "content": r.content,
                "created_at": r.created_at,
            }
            for r in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@admin_reports_router.delete("/{report_id}")
def admin_delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if report:
        db.delete(report)
        db.commit()
    return {"ok": True}
