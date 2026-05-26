import subprocess
import os
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from app.api.deps import get_current_admin
from app.services.log_service import LogService
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admin", tags=["Admin"])

BACKUP_DIR = "backups"

@router.post("/backup")
def create_backup(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)
    
    subprocess.run([
        "pg_dump",
        "-U", "postgres",
        "-h", "localhost",
        "-d", "cinema_db",
        "-f", filepath
    ], env={**os.environ, "PGPASSWORD": "postgres"})
    
    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="CREATE_BACKUP",
        details={"filename": filename},
        ip_address=request.client.host
    )
    
    return {"message": f"Backup created: {filename}"}