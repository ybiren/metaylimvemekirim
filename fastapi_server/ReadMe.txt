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
rsync -avz --exclude ".venv/" --exclude "__pycache__/" --exclude "data/" --delete /mnt/f/yossi/angular/metaylimvemekirim/fastapi_server  root@194.36.90.119:/root

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


 conect to remote from local (terminal 1):
 ssh -L 15433:127.0.0.1:5433 root@194.36.90.119
 
 bash (terminal 2)
 psql 'postgresql://postgres:StrongPass123!@127.0.0.1:15433/metaylim'






 in case of account lock (delete pgadmin and recreate it):
 
 1) docker rm -f pgadmin
 
 2) docker volume ls | grep pgadmin
    docker volume rm <volume_name>
 
 3) docker run -d \
  --name pgadmin \
  --network pgnet \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=sar888@gmail.com \
  -e PGADMIN_DEFAULT_PASSWORD=jordan \
  -e PGADMIN_CONFIG_SERVER_MODE=False \
  -v /opt/pgadmin/servers.json:/pgadmin4/servers.json \
  --restart=always \
  dpage/pgadmin4  

  for checking if port is open:
  sudo ss -tulpn | grep :5050





  domain issues on linux:
  this is conf file
  /etc/nginx/conf.d

  edit metaylimvemekirim.conf:

  ''''''''''''''''''''''''''''''''''''''''''''''
  server {

    listen 80 default_server;
    listen [::]:80 default_server;
    server_name metaylimvemekirim.co.il www.metaylimvemekirim.co.il _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ''''''''''''''''''''''''''''''''''''''''''''''''

  
  finally run:
  sudo nginx -t
  sudo systemctl reload nginx


