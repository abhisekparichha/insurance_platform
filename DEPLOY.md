# Deployment Guide

## Local Linux Laptop (Ubuntu / Debian)

### Automated install (recommended)

```bash
git clone https://github.com/abhisekparichha/insurance_platform.git
cd insurance_platform
chmod +x install.sh
./install.sh
```

The script installs all dependencies, builds the frontend, and optionally registers a systemd service so the app restarts on boot.

---

### Manual step-by-step

#### 1 — Prerequisites

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# Python + build tools
sudo apt install -y python3 python3-pip build-essential python3-dev git
```

#### 2 — Clone and install

```bash
git clone https://github.com/abhisekparichha/insurance_platform.git
cd insurance_platform
pip install -r requirements.txt
```

#### 3 — Start (production mode)

```bash
chmod +x start.sh
./start.sh               # port 3001
PORT=8080 ./start.sh     # custom port
```

What `start.sh` does in order:
1. `pnpm install` — root JS dependencies
2. `cd frontend && pnpm install && pnpm build` — builds React → `frontend/dist/`
3. `node --import tsx/esm server/index.ts` — starts Express (serves API + built frontend on same port)

#### 4 — Dev mode (hot reload)

```bash
chmod +x dev.sh
./dev.sh
# API  → http://localhost:3001   (tsx watch, restarts on .ts changes)
# UI   → http://localhost:5173   (Vite HMR, instant browser refresh)
```

#### 5 — Auto-start on boot (systemd)

```bash
sudo tee /etc/systemd/system/insurance-platform.service > /dev/null << EOF
[Unit]
Description=Insurance Platform
After=network.target

[Service]
WorkingDirectory=$HOME/insurance_platform
ExecStart=/bin/bash $HOME/insurance_platform/start.sh
Restart=on-failure
RestartSec=5
User=$USER
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now insurance-platform
```

Useful commands:
```bash
sudo systemctl status insurance-platform
sudo systemctl restart insurance-platform
sudo journalctl -u insurance-platform -f    # live logs
```

#### 6 — Internet access without fixed IP (Cloudflare Tunnel — free)

```bash
# Install cloudflared once
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Quick share (temporary URL, no account needed)
cloudflared tunnel --url http://localhost:3001
# Prints: https://some-random-name.trycloudflare.com

# Permanent URL (needs a free Cloudflare account + any domain)
cloudflared tunnel login
cloudflared tunnel create insurance-platform
cloudflared tunnel route dns insurance-platform yourapp.yourdomain.com
cloudflared tunnel run insurance-platform
```

Install as a service (auto-starts with the app):
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

---

## Free Cloud Servers

### Option 1 — Oracle Cloud Always Free ⭐ (best)

**Specs**: 4 ARM cores · 24 GB RAM · 200 GB disk — genuinely permanent free tier.

**Steps**:
1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) (credit card required for identity, not charged)
2. Create an instance: **Compute → Instances → Create**
   - Shape: `VM.Standard.A1.Flex` (ARM) — select 4 OCPUs, 24 GB RAM
   - Image: `Ubuntu 22.04`
   - Add your SSH public key
3. Open port 3001 in the security list:
   - Networking → Virtual Cloud Networks → your VCN → Security Lists → Add Ingress Rule
   - Source: `0.0.0.0/0`, Port: `3001`
4. Also open port in the OS firewall:
   ```bash
   sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
   sudo netfilter-persistent save
   ```
5. SSH in and run the installer:
   ```bash
   ssh ubuntu@<your-public-ip>
   git clone https://github.com/abhisekparichha/insurance_platform.git
   cd insurance_platform
   chmod +x install.sh
   ./install.sh
   ```
6. App is live at `http://<your-public-ip>:3001`

For HTTPS with a custom domain, point your domain to the IP and run:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# Add nginx reverse proxy config (see below), then:
sudo certbot --nginx -d yourapp.yourdomain.com
```

Nginx config (`/etc/nginx/sites-available/insurance-platform`):
```nginx
server {
    server_name yourapp.yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/insurance-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### Option 2 — Fly.io (free hobby tier)

**Specs**: Shared CPU · 256 MB RAM · free allowance of ~3 small VMs.

**Steps**:
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Sign up: `fly auth signup`
3. From the project root:
   ```bash
   fly launch --name insurance-platform --region bom   # bom = Mumbai
   ```
4. Set port in `fly.toml`:
   ```toml
   [[services]]
     internal_port = 3001
     protocol = "tcp"
     [[services.ports]]
       port = 80
       handlers = ["http"]
     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```
5. Create a `Dockerfile` (see below) and deploy:
   ```bash
   fly deploy
   ```

`Dockerfile`:
```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y python3 python3-pip build-essential python3-dev
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt --break-system-packages
RUN npm install -g pnpm && pnpm install && cd frontend && pnpm install && pnpm build && cd ..
EXPOSE 3001
CMD ["node", "--import", "tsx/esm", "server/index.ts"]
```

---

### Option 3 — Render (free web service)

**Specs**: 512 MB RAM, spins down after 15 min of inactivity (free tier).

**Steps**:
1. Sign up at [render.com](https://render.com)
2. New → Web Service → Connect your GitHub repo
3. Settings:
   - **Environment**: `Docker` (uses the Dockerfile above)
   - **Port**: `3001`
   - **Plan**: Free
4. Click Deploy — Render builds and hosts it automatically on every `git push`

---

### Comparison

| | Oracle Free | Fly.io | Render |
|---|---|---|---|
| Cost | Always free | Free tier | Free tier |
| RAM | 24 GB | 256 MB | 512 MB |
| CPU | 4 ARM cores | Shared | Shared |
| Disk | 200 GB | 1 GB | None (ephemeral) |
| Sleep on idle | No | No | Yes (15 min) |
| Custom domain + HTTPS | Yes (via nginx+certbot) | Yes (built-in) | Yes (built-in) |
| Best for | Full production use | Small demos | Quick demos |

**Recommendation**: Oracle Cloud Always Free for anything serious. Render for the quickest zero-config demo deployment.

---

## Running the Data Pipeline

After the app is running, populate real insurance data:

```bash
# Full async pipeline (crawls IRDAI + downloads PDFs)
python -m src.async_pipeline --workers 10 --db data/insurance.db

# Limit to 3 insurers for a quick test
python -m src.async_pipeline --workers 5 --max-insurers 3

# Run QC checks manually
python -m src.qc_worker --db data/insurance.db --job a   # link check
python -m src.qc_worker --db data/insurance.db --job b   # content drift
```

The Express server automatically detects when `data/insurance.db` has active products and switches from demo seed data to live crawled data — no restart required.
