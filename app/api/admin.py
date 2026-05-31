import subprocess
import os
import glob
from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException, status, BackgroundTasks
from app.api.deps import get_current_admin
from app.services.log_service import LogService
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admin", tags=["Admin"])

BACKUP_DIR = "backups"

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "cinema_db")


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
        "-U", DB_USER,
        "-h", DB_HOST,
        "-d", DB_NAME,
        "-f", filepath
    ], env={**os.environ, "PGPASSWORD": DB_PASSWORD})
    
    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="CREATE_BACKUP",
        details={"filename": filename},
        ip_address=request.client.host
    )
    
    return {"message": f"Backup created: {filename}"}

@router.post("/restore")
def restore_backup(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    files = sorted(glob.glob(f"{BACKUP_DIR}/*.sql"), reverse=True)
    
    if not files:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "No backup files found"
        )
    
    latest_backup = files[0]
    background_tasks.add_task(run_restore, latest_backup)
    
    return {"message": f"Database restore started from {os.path.basename(latest_backup)}"}

def run_restore(backup_file: str):
    subprocess.run([
        "psql",
        "-U", DB_USER,
        "-h", DB_HOST,
        "-d", DB_NAME,
        "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    ], env={**os.environ, "PGPASSWORD": DB_PASSWORD}, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    subprocess.run([
        "psql",
        "-U", DB_USER,
        "-h", DB_HOST,
        "-d", DB_NAME,
        "-f", backup_file
    ], env={**os.environ, "PGPASSWORD": DB_PASSWORD}, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    subprocess.run([
        "psql",
        "-U", DB_USER,
        "-h", DB_HOST,
        "-d", DB_NAME,
        "-c", "SELECT setval('action_logs_action_log_id_seq', (SELECT MAX(action_log_id) FROM action_logs));"
    ], env={**os.environ, "PGPASSWORD": DB_PASSWORD}, stdout=subprocess.PIPE, stderr=subprocess.PIPE)