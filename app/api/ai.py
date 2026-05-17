from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status, Request
from pydantic import BaseModel
from app.ai_models.occupancy_predictor import OccupancyPredictor
from app.api.deps import get_current_cinema_admin, get_current_admin
from app.models import models
from app.database import get_db
from app.services.log_service import LogService
from sqlalchemy.orm import Session
import sys
import subprocess

router = APIRouter(prefix="/ai", tags=["AI"])

class PredictRequest(BaseModel):
    session_id: int

predictor = OccupancyPredictor()

@router.get("/history")
def get_training_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    history = db.query(models.TrainingHistory).order_by(
        models.TrainingHistory.trained_at.desc()
    ).limit(10).all()
    
    return [
        {
            "id": h.id,
            "trained_at": h.trained_at.isoformat(),
            "mae": round(h.mae, 4),
            "mape": round(h.mape, 4),
            "mse": round(h.mse, 4),
            "rmse": round(h.rmse, 4),
            "r2": round(h.r2, 4),
            "samples_count": h.samples_count,
            "features_used": h.features_used
        }
        for h in history
    ]

@router.post("/predict-occupancy")
def predict_occupancy(
    data: PredictRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    session = db.query(models.Session).filter(
        models.Session.session_id == data.session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found")
    
    hall = db.query(models.Hall).filter(
        models.Hall.hall_id == session.hall_id
    ).first()
    
    pred = predictor.predict_single({
        "date": session.start_time.strftime("%Y-%m-%d"),
        "session_hour": session.start_time.hour,
        "ticket_price": session.price,
        "capacity": hall.rows_count * hall.seats_per_row
    })

    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="AI_PREDICT",
        details={
            "session_id": data.session_id,
            "predicted_rate": round(pred, 2)
        },
        ip_address=request.client.host
    )
    
    return {
        "session_id": data.session_id,
        "predicted_occupancy_rate": round(pred, 2)
    }

@router.post("/admin/retrain")
def retrain_model(
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    background_tasks.add_task(run_retraining)

    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="AI_RETRAIN",
        details={ },
        ip_address= request.client.host
    )
    
    return {"message": "Retraining started in background"}

def run_retraining():
    subprocess.run([sys.executable, "-m", "app.ai_models.train"])