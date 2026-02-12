from fastapi import APIRouter, Body, HTTPException
from typing import List

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

# TEMP: in-memory store (replace with DB later)
UPDATES = [
  {
    "id": 1,
    "title": "בואו לנהל אתר משלכם!",
    "href": "http://www.pgoshoti.co.il/site.asp",
    "isPromo": True,
    "underline": True,
    "bold": True,
    "targetBlank": True,
    "sortOrder": 1,
    "isActive": True,
  },
  {
    "id": 1,
    "title": "עובד לחברת JOBCLICK",
    "href": "http://www.pgoshoti.co.il/site.asp",
    "isPromo": True,
    "underline": True,
    "bold": True,
    "targetBlank": True,
    "sortOrder": 1,
    "isActive": True,
  }
]

NEXT_ID = 3

@admin_router.get("/updates", response_model=List[dict])
def list_updates():
    return UPDATES

@admin_router.post("/updates")
def create_update(payload: dict = Body(...)):
    global NEXT_ID
    row = {**payload, "id": NEXT_ID}
    NEXT_ID += 1
    UPDATES.append(row)
    return row

@admin_router.put("/updates/{id}")
def update_update(id: int, payload: dict = Body(...)):
    for i, row in enumerate(UPDATES):
        if row["id"] == id:
            UPDATES[i] = {**payload, "id": id}
            return UPDATES[i]
    raise HTTPException(status_code=404, detail="Not found")

@admin_router.delete("/updates/{id}")
def delete_update(id: int):
    global UPDATES
    before = len(UPDATES)
    UPDATES = [x for x in UPDATES if x["id"] != id]
    if len(UPDATES) == before:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
