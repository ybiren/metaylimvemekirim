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
 
 2) docker volume ls | grep pgadmin ssh -L 15433:127.0.0.1:5433 root@194.36.90.119

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





domainthenet
sar888@gmail.com
h!BKTH@LxbiCjh3



https://mailadmin.zoho.com/
login gmail bengold789

admin@metaylimvemekirim.co.il
bmyPk-v9

https://accounts.zoho.com/home#profile/personal


sendgrid.com



//BOT (Groq) - /api/bot/ask
The Q&A bot needs a Groq API key. It is read from the environment, with
fastapi_server/.env as a fallback. .env is gitignored, but the rsync line
above only excludes .venv/, __pycache__/ and data/ - so .env IS copied to
prod along with the code. Create it once locally:

  cp .env.example .env      # then paste the key into GROQ_API_KEY

httpx and python-dotenv are new dependencies. rsync excludes .venv/, so
after deploying you must install them on the server once:

  cd /root/fastapi_server && source .venv/bin/activate
  pip install -r requirements.txt
  pkill -f uvicorn
  nohup uvicorn main:app --host 0.0.0.0 --port 8000 &

Keys are managed at https://console.groq.com/keys
Without a key the endpoint answers 503 and the widget shows an error.
The bot's knowledge base is fastapi_server/knowledge/bot_knowledge.md, built
from 6.docx (the user guide, which replaced bot.docx). It is read once at
import, so the server must be restarted after changing it. The guide is
written entirely for visitors; the bot's behaviour rules are not in it, they
live in SYSTEM_PROMPT in routes/bot.py.


//SOCIAL LOGIN (Google / Facebook) - /login/google, /login/facebook
The login page can also sign members in through Google or Facebook. It signs
in existing members only: registration here asks for a whole profile that
neither provider can supply, so an unknown address gets a 404 and the client
sends the visitor to /register with their name and email already filled in.

Configured through the same fastapi_server/.env as the bot:

  GOOGLE_CLIENT_ID       - an "OAuth client ID" of type "Web application" from
                           https://console.cloud.google.com/apis/credentials
                           List https://metaylimvemekirim.co.il and
                           http://localhost:4200 under "Authorized JavaScript
                           origins". Leave "Authorized redirect URIs" empty:
                           the browser receives an ID token in the page and
                           never navigates away, so there is nothing to redirect
                           back to. There is no client secret to set either -
                           Google signs the token and the server checks that
                           signature, which needs only the public client id.
  FACEBOOK_APP_ID
  FACEBOOK_APP_SECRET    - an app at https://developers.facebook.com/apps with
                           the "Facebook Login" product added. Under Facebook
                           Login > Settings turn on "Login with the JavaScript
                           SDK" and list https://metaylimvemekirim.co.il and
                           http://localhost:4200 under "Allowed Domains for the
                           JavaScript SDK". That is the setting this flow obeys
                           - "Valid OAuth Redirect URIs" governs the redirect
                           flow, which the client does not use.

                           A new app starts in Development mode, where ONLY
                           accounts holding a role on it (App roles > Roles)
                           can log in - everyone else gets an error that looks
                           like a broken button. Switch the app to Live before
                           members use it. Live requires a privacy policy URL,
                           data deletion instructions, an icon and a category,
                           but email and public_profile are default permissions
                           so there is no App Review to submit.

Leave a provider's variables blank and its button never appears - the client
asks GET /auth/config first and only draws what the server says is set up.
The client ids are public; the Facebook secret is not, and never leaves the
server. It is what proves to Facebook that a token was issued to OUR app -
without that check any Facebook app's token would log its holder in here.

Both providers require HTTPS and an origin they know about, so neither button
works from an address you have not registered with them.

Registering from a social login - POST /register with social_credential
A visitor whose address has no profile is sent to the registration form with
the provider token carried in the router state (never the URL - it is a
credential). The form then asks for no password, and shows the address as
read-only, because the token already proves the address is theirs, which is
all the password and the emailed confirmation link prove at that point.

The form posts the token back as social_provider + social_credential, and
/register re-verifies it through the same code the login routes use. The
address is taken from the provider's answer and the submitted c_email is
ignored - otherwise a token for one address could register another. The row is
then written with no password_hash and is_email_verified already true, so there
is no confirmation mail to wait for.

Such a member enters only through their provider until they set a password,
which they can do at any time through "forgot password" - /reset-password
assigns the hash rather than replacing a known one. Until then the password
login answers "bad credentials", the same as a wrong password, so nothing about
the account leaks to someone guessing at the form.
