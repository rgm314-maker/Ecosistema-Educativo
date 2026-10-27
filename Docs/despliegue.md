# Despliegue en Ubuntu 22.04 o 24.04

Esta guía instala la aplicación en `/srv/ecosistema-educativo`, ejecuta Node.js como el usuario sin privilegios `ecosistema` y deja Nginx como único servicio público. Sustituye `URL_DEL_REPOSITORIO` por la URL Git real y `dominio` por el dominio definitivo. Antes de empezar, crea un registro DNS `A` para `dominio` apuntando a la IP del VPS.

## 1. Entrar al servidor y actualizarlo

Conéctate con la cuenta administrativa que entrega el proveedor del VPS:

```bash
ssh ubuntu@IP_DEL_SERVIDOR
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl nginx ufw rsync snapd
```

No ejecutes la aplicación como `root`.

## 2. Crear el usuario de la aplicación

Este usuario no se agrega al grupo `sudo`:

```bash
sudo adduser --disabled-password --gecos "" ecosistema
sudo install -d -o ecosistema -g ecosistema -m 0755 /srv/ecosistema-educativo
```

Todas las operaciones de la aplicación se ejecutarán como `ecosistema`; la cuenta administrativa solo se usa para instalar y configurar servicios del sistema.

## 3. Instalar Node.js LTS y PM2

Descarga y ejecuta el instalador LTS de NodeSource, instala Node.js y comprueba que sea 20 o superior:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
rm /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
sudo npm install --global pm2
pm2 --version
```

## 4. Clonar e instalar la aplicación

```bash
sudo -u ecosistema git clone URL_DEL_REPOSITORIO /srv/ecosistema-educativo
sudo -iu ecosistema
cd /srv/ecosistema-educativo
npm ci --omit=dev
mkdir -p logs
```

No ejecutes `npm run semilla` en producción: crea cuentas y datos de demostración.

## 5. Crear el archivo `.env`

Todavía como `ecosistema`, crea un archivo privado:

```bash
cd /srv/ecosistema-educativo
umask 077
cp .env.ejemplo .env
nano .env
```

Contenido recomendado:

```dotenv
NODE_ENV=production
PUERTO=3000
IA_PROVEEDOR=gemini
IA_CLAVE=REEMPLAZAR_POR_LA_CLAVE_REAL
IA_MODELO=gemini-flash-lite-latest
```

Guarda con `Ctrl+O`, confirma con `Enter` y sal con `Ctrl+X`. Después:

```bash
chmod 600 .env
```

`datos/config/ajustes.json` tiene prioridad sobre las variables de IA. Verifica que `iaClave` esté vacía si la clave se administrará desde `.env`; nunca confirmes una clave real en Git.

```bash
nano datos/config/ajustes.json
```

## 6. Crear el administrador inicial

El comando solicita nombre, apellido, correo y una contraseña de al menos ocho caracteres con letras y números:

```bash
cd /srv/ecosistema-educativo
npm run crear-admin
```

## 7. Iniciar con PM2

El archivo `ecosystem.config.cjs` ejecuta una instancia, reinicia el proceso si falla o supera 512 MB y escribe los registros en `logs/`.

```bash
cd /srv/ecosistema-educativo
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
pm2 logs ecosistema-educativo --lines 50
exit
```

Activa la restauración automática después de reiniciar el VPS, desde la cuenta administrativa:

```bash
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u ecosistema --hp /home/ecosistema
sudo -u ecosistema env PM2_HOME=/home/ecosistema/.pm2 pm2 save
sudo systemctl enable --now pm2-ecosistema
sudo systemctl status pm2-ecosistema --no-pager
```

Configura rotación para que los registros no llenen el disco:

```bash
sudo tee /etc/logrotate.d/ecosistema-educativo >/dev/null <<'EOF'
/srv/ecosistema-educativo/logs/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
  su ecosistema ecosistema
}
EOF
```

## 8. Configurar Nginx

El proyecto usa `maxSubidaMB: 10`; por eso Nginx acepta hasta `10m`. Si cambias ese ajuste, actualiza también `client_max_body_size`.

```bash
sudo tee /etc/nginx/sites-available/ecosistema-educativo >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name dominio;

    client_max_body_size 10m;

    location ~* ^/(css|js)/ {
        root /srv/ecosistema-educativo/publico;
        try_files $uri @aplicacion;
        expires 1h;
        add_header Cache-Control "public, max-age=3600" always;
        access_log off;
    }

    location /recursos/ {
        root /srv/ecosistema-educativo/publico;
        try_files $uri @aplicacion;
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 90s;
    }

    location @aplicacion {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sfn /etc/nginx/sites-available/ecosistema-educativo /etc/nginx/sites-enabled/ecosistema-educativo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Comprueba primero el proxy por HTTP:

```bash
curl -I http://dominio
```

## 9. Activar el cortafuegos

Abre SSH antes de habilitar UFW para no perder la conexión:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

No abras el puerto 3000. Si el proveedor usa un cortafuegos adicional, permite allí también TCP 22, 80 y 443.

## 10. Activar HTTPS con Certbot

Cuando `http://dominio` responda y el DNS ya apunte al VPS:

```bash
sudo apt remove -y certbot
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d dominio --redirect
sudo certbot renew --dry-run
```

Certbot instala la renovación automática. Compruébala con:

```bash
systemctl list-timers | grep certbot
curl -I https://dominio
```

## 11. Respaldo diario y copia fuera del servidor

Los respaldos locales se guardarán en `/home/ecosistema/respaldos`, se conservarán 14 días y después se copiarán por SSH a otra máquina. En el servidor externo crea previamente el usuario `respaldo` y el directorio `/srv/respaldos/ecosistema`.

En el VPS de la aplicación, entra como el usuario de servicio y configura una clave exclusiva para respaldos:

```bash
sudo -iu ecosistema
mkdir -p ~/.ssh ~/bin ~/respaldos ~/logs
chmod 700 ~/.ssh ~/bin ~/respaldos
ssh-keygen -t ed25519 -f ~/.ssh/id_respaldo -C "respaldo-ecosistema"
ssh-copy-id -i ~/.ssh/id_respaldo.pub respaldo@SERVIDOR_DE_RESPALDO
```

Crea el script y sustituye `SERVIDOR_DE_RESPALDO` si es necesario:

```bash
cat > ~/bin/respaldo-ecosistema.sh <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/srv/ecosistema-educativo"
BACKUP_DIR="/home/ecosistema/respaldos"
MARCA="$(date -u +%Y-%m-%d_%H-%M-%S)"
ARCHIVO="$BACKUP_DIR/datos_$MARCA.tar.gz"
REMOTO_USUARIO="respaldo"
REMOTO_HOST="SERVIDOR_DE_RESPALDO"
REMOTO_DIR="/srv/respaldos/ecosistema"
CLAVE="/home/ecosistema/.ssh/id_respaldo"

mkdir -p "$BACKUP_DIR"
tar --exclude='datos/respaldos' -C "$APP_DIR" -czf "$ARCHIVO" datos/
find "$BACKUP_DIR" -type f -name 'datos_*.tar.gz' -mtime +13 -delete
rsync -az -e "ssh -i $CLAVE" "$ARCHIVO" "$REMOTO_USUARIO@$REMOTO_HOST:$REMOTO_DIR/"
ssh -i "$CLAVE" "$REMOTO_USUARIO@$REMOTO_HOST" \
  "find '$REMOTO_DIR' -type f -name 'datos_*.tar.gz' -mtime +13 -delete"
EOF

chmod 700 ~/bin/respaldo-ecosistema.sh
~/bin/respaldo-ecosistema.sh
ls -lh ~/respaldos
```

Verifica que el archivo también exista en el servidor externo. Luego programa el respaldo todos los días a las 02:15:

```bash
crontab -e
```

Agrega esta línea:

```cron
15 2 * * * /home/ecosistema/bin/respaldo-ecosistema.sh >> /home/ecosistema/logs/respaldo.log 2>&1
```

Sal de la cuenta de servicio cuando termines:

```bash
exit
```

## 12. Procedimiento de actualización

Primero ejecuta y comprueba un respaldo. Después actualiza únicamente si `git status` no muestra cambios locales inesperados:

```bash
sudo -iu ecosistema
/home/ecosistema/bin/respaldo-ecosistema.sh
cd /srv/ecosistema-educativo
git status --short
git pull --ff-only
npm ci --omit=dev
node --check servidor/server.js
mkdir -p logs
pm2 reload ecosystem.config.cjs --update-env
pm2 save
pm2 status
pm2 logs ecosistema-educativo --lines 50
exit
```

Si también cambió la configuración de Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 13. Comandos de diagnóstico

```bash
sudo -u ecosistema env PM2_HOME=/home/ecosistema/.pm2 pm2 status
sudo -u ecosistema env PM2_HOME=/home/ecosistema/.pm2 pm2 logs ecosistema-educativo --lines 100
sudo journalctl -u pm2-ecosistema -n 100 --no-pager
sudo journalctl -u nginx -n 100 --no-pager
sudo ss -ltnp | grep -E ':80|:443|:3000'
```

Si aparece `EADDRINUSE` en el puerto 3000, no ejecutes `npm start` además de PM2. Comprueba el proceso con `pm2 status` y reinícialo con `pm2 restart ecosistema-educativo`.

## Lista de comprobación final

- [ ] El DNS de `dominio` apunta a la IP pública correcta.
- [ ] `node --version` muestra Node.js 20 o superior.
- [ ] La aplicación corre como `ecosistema`, nunca como `root`.
- [ ] `.env` tiene permisos `600` y ninguna clave está confirmada en Git.
- [ ] `pm2 status` muestra `ecosistema-educativo` como `online`.
- [ ] `systemctl status pm2-ecosistema` y `systemctl status nginx` están activos.
- [ ] UFW permite únicamente 22, 80 y 443 como puertos públicos requeridos.
- [ ] `https://dominio` carga y redirige desde HTTP.
- [ ] `certbot renew --dry-run` termina correctamente.
- [ ] El administrador puede iniciar sesión y cambiar su contraseña.
- [ ] Una subida de hasta 10 MB funciona y una mayor se rechaza.
- [ ] Los archivos de `/css`, `/js` y `/recursos` incluyen cabeceras de caché.
- [ ] El respaldo manual abre correctamente con `tar -tzf ARCHIVO.tar.gz`.
- [ ] Existe una copia reciente en el servidor externo y se eliminan copias de más de 14 días.
- [ ] Después de reiniciar el VPS, PM2 restaura la aplicación automáticamente.
