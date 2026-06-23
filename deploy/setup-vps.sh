#!/bin/bash
set -e

# ─── Args ─────────────────────────────────────────────────────────────────────
DOMAIN=""
for arg in "$@"; do
  case $arg in
    --domain=*) DOMAIN="${arg#*=}" ;;
    --domain)   shift; DOMAIN="$1" ;;
  esac
done

echo "========================================="
echo "  Kingdoms Harvest - VPS Setup"
echo "========================================="

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Ejecutar como root (sudo ./setup-vps.sh --domain=myjame.com)"
  exit 1
fi

# Pedir dominio si no se pasó como argumento
if [ -z "$DOMAIN" ]; then
  read -rp "Dominio del servidor (ej: kingdoms.myjame.com): " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
  echo "ERROR: Se requiere un dominio. Uso: sudo ./setup-vps.sh --domain=myjame.com"
  exit 1
fi

echo "  Dominio: $DOMAIN"

echo ""
echo "=== Actualizando sistema ==="
apt update && apt upgrade -y

echo ""
echo "=== Instalando dependencias del sistema ==="
apt install -y curl git ufw nginx certbot python3-certbot-nginx gettext-base

echo ""
echo "=== Instalando Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

echo ""
echo "=== Instalando PM2 ==="
npm install -g pm2

echo ""
echo "=== Creando usuario 'kingdoms' ==="
if id "kingdoms" &>/dev/null; then
  echo "Usuario 'kingdoms' ya existe, saltando..."
else
  adduser --disabled-password --gecos "" kingdoms
  echo "Usuario 'kingdoms' creado"
fi

echo ""
echo "=== Configurando firewall (ufw) ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

echo ""
echo "========================================="
echo "  Setup completado!"
echo "========================================="
echo ""
echo "Próximos pasos:"
echo "  1. Clonar repo como usuario 'kingdoms':"
echo "     su - kingdoms"
echo "     cd /home/kingdoms"
echo "     git clone <tu-repo> app"
echo ""
echo "  2. Configurar server/.env"
echo ""
echo "  3. Instalar deps y build:"
echo "     cd app/server && npm install --production"
echo "     cd ../client && npm install && npm run build"
echo ""
echo "  4. Generar configuración de Nginx para $DOMAIN:"
echo "     DOMAIN=$DOMAIN envsubst '\${DOMAIN}' \\"
echo "       < /home/kingdoms/app/deploy/nginx.conf.template \\"
echo "       > /etc/nginx/sites-available/kingdoms-harvest"
echo "     ln -sf /etc/nginx/sites-available/kingdoms-harvest /etc/nginx/sites-enabled/"
echo "     rm -f /etc/nginx/sites-enabled/default"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  5. SSL con certbot:"
echo "     certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "  6. Iniciar con PM2:"
echo "     su - kingdoms"
echo "     cd /home/kingdoms/app"
echo "     mkdir -p logs"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo "     # Como root:"
echo "     sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u kingdoms --hp /home/kingdoms"
echo ""

