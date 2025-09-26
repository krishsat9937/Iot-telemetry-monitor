from pydantic import BaseModel
from datetime import datetime

class TelemetryIn(BaseModel):
    deviceId: str
    metric: str
    value: float
    unit: str
    timestamp: datetime
