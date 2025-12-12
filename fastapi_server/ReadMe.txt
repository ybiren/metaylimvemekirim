#To run python server n ubuntu
yossi@DESKTOP-V70AVCN:/mnt/f/yossi/angular/metaylimvemekirim/fastapi_server$ python3 -m venv .venv
yossi@DESKTOP-V70AVCN:/mnt/f/yossi/angular/metaylimvemekirim/fastapi_server$ source .venv/bin/activate

uvicorn main:app --reload

//windows
uvicorn main:app --host 0.0.0.0 --port 8000
//linux
nohup uvicorn main:app --host 0.0.0.0 --port 8000 & 
//kill uvicorn on linux
pkill -f uvicorn
//for checking
lsof -i :8000



1. Copy server code
rsync -avz --exclude ".venv/" --exclude "__pycache__/" --delete /mnt/f/yossi/angular/metaylimvemekirim/fastapi_server  root@194.36.90.119:/root

2. copy bundles
rsync -avz --delete /mnt/f/yossi/angular/metaylimvemekirim/dist/metaylimvemekirim/browser/ root@194.36.90.119:/root/dist/metaylimvemekirim/browser





pgadmin:  sar888@gmail.com / jordan
194.36.90.119:5050

//THIS IS THE CONTAINER ON PROD (194.36.90.119)
docker run -d --name postgres1 \
  --network pgnet \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD='StrongPass123!' \
  -e POSTGRES_DB=postgres \
  -p 5433:5432 \
  --restart=always \
  postgres:16



backup scripts:

#!/bin/bash
set -e

DATE=$(date +%F)
BACKUP_DIR="/root/pg_backups"
DB_NAME="metaylim"
CONTAINER="postgres1"

mkdir -p "$BACKUP_DIR"

docker exec -t "$CONTAINER" \
  pg_dump -U postgres "$DB_NAME" \
  > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql"
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -delete

chmod +x /root/backup_postgres.sh

Schedule it with cron (daily at 02:00)
Edit root’s crontab:
crontab -e

Add:
0 2 * * * /root/backup_postgres.sh >> /root/backup.log 2>&1


Save.
5️⃣ Verify cron is active
systemctl status crond


If not running:
systemctl enable --now crond