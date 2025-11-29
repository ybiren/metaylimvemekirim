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
rsync -avz --exclude ".venv/" --exclude "__pycache__/" --delete /mnt/f/yossi/angular/metaylimvemekirim/fastapi_server  root@194.36.90.119:/root/fastapi_server

2. copy bundles
rsync -avz --delete /mnt/f/yossi/angular/metaylimvemekirim/dist/metaylimvemekirim/browser/ root@194.36.90.119:/root/dist/metaylimvemekirim/browser




