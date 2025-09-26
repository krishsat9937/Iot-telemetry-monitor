import os, json, asyncio
from datetime import datetime
from typing import AsyncGenerator
from fastapi import FastAPI, Depends, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from .db import Base, engine, get_session
from .models import Telemetry
from .schemas import TelemetryIn

API_KEY = os.getenv("API_KEY", "dev-demo-key")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()] or ["*"]

app = FastAPI(title="Telemetry Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/healthz")
async def healthz():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status":"ok","time":datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

def require_api_key(x_api_key: str | None = Header(default=None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

subscribers: list[asyncio.Queue] = []

@app.post("/api/telemetry", status_code=202, dependencies=[Depends(require_api_key)])
async def ingest(payload: TelemetryIn, session: AsyncSession = Depends(get_session)):
    row = Telemetry(
        device_id=payload.deviceId,
        metric=payload.metric,
        value=payload.value,
        unit=payload.unit,
        timestamp=payload.timestamp,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    msg = {
        "id": row.id, "device_id": row.device_id, "metric": row.metric,
        "value": row.value, "unit": row.unit,
        "timestamp": row.timestamp.isoformat(), "created_at": row.created_at.isoformat()
    }
    for q in list(subscribers):
        await q.put(msg)
    return {"status":"queued","id":row.id}

@app.get("/api/stream")
async def stream():
    async def gen() -> AsyncGenerator[bytes, None]:
        q: asyncio.Queue = asyncio.Queue()
        subscribers.append(q)
        try:
            while True:
                item = await q.get()
                yield f"data: {json.dumps(item)}\n\n".encode("utf-8")
        finally:
            if q in subscribers: subscribers.remove(q)
    return StreamingResponse(gen(), media_type="text/event-stream")

@app.get("/api/telemetry")
async def list_latest(limit: int = 50, session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Telemetry).order_by(Telemetry.id.desc()).limit(limit))).scalars().all()
    return [
        {
            "id": r.id, "device_id": r.device_id, "metric": r.metric,
            "value": r.value, "unit": r.unit,
            "timestamp": r.timestamp.isoformat(), "created_at": r.created_at.isoformat()
        } for r in rows
    ]
