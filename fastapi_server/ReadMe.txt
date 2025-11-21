#To run python server n ubuntu
yossi@DESKTOP-V70AVCN:/mnt/f/yossi/angular/metaylimvemekirim/fastapi_server$ python3 -m venv .venv
yossi@DESKTOP-V70AVCN:/mnt/f/yossi/angular/metaylimvemekirim/fastapi_server$ source .venv/bin/activate

uvicorn main:app --reload




1. Copy server code
rsync -avz --exclude ".venv/" --exclude "__pycache__/" --delete /mnt/f/yossi/angular/metaylimvemekirim/fastapi_server  root@194.36.90.119:/root/fastapi_server

2. copy bundles
rsync -avz /mnt/f/yossi/angular/metaylimvemekirim/dist/metaylimvemekirim/browser/ root@194.36.90.119:/root/dist/metaylimvemekirim/browser


