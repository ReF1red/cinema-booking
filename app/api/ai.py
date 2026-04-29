from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from app.ai_models.occupancy_predictor import OccupancyPredictor
from app.api.deps import get_current_cinema_admin, get_current_admin
import sys
import subprocess

router = APIRouter(prefix="/ai", tags=["AI"])

class PredictRequest(BaseModel):
    session_hour: int
    date: str
    ticket_price: float
    capacity: int

predictor = OccupancyPredictor()

@router.post("/predict-occupancy")
def predict_occupancy(
    data: PredictRequest,
    current_user = Depends(get_current_cinema_admin)
):
    pred = predictor.predict_single(data.dict())
    return {"predicted_occupancy_rate": round(pred, 2)}

@router.post("/admin/retrain")
def retrain_model(
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_admin)
):
    background_tasks.add_task(run_retraining)
    return {"message": "Retraining started in background"}

def run_retraining():
    subprocess.run([sys.executable, "-m", "app.ai_models.train"])