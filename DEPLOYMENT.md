# Deployment Guide

## TL;DR

**Frontend (TanStack Start)** = SSR Node.js server, NOT static files!
**Backend (FastAPI)** = Python API server

Both run as **separate processes** in production. Use nginx to combine them on one domain.

---

## Prerequisites

**⚠️ Merge PR #4 first!**
```bash
cd ../pocket-dev-guild
gh pr merge 4  # Adds /api prefix to backend endpoints
```

---

## Development Mode

```bash
# Terminal 1: Backend
cd ../pocket-dev-guild
uvicorn main:app --reload

# Terminal 2: Frontend (auto-proxies to backend)
cd ../remix-of-frontend-guild-prep
npm run dev
```

Access at: `http://localhost:3000`

---

## Production Mode (Two-Process Setup)

### Step 1: Build Frontend
```bash
cd ../remix-of-frontend-guild-prep
npm run build
```

### Step 2: Run Both Services
```bash
# Terminal 1: Backend
cd ../pocket-dev-guild
uvicorn main:app
# Running at :8000

# Terminal 2: Frontend SSR Server
cd ../remix-of-frontend-guild-prep
npm run preview
# Running at :3000
```

### Step 3: Combine with nginx (Recommended)

Create `/etc/nginx/sites-available/pocket-dev-guild`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend SSR
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/pocket-dev-guild /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

Access at: `http://yourdomain.com`

---

## How It Works

### Architecture
```
Browser → nginx (:80)
            ├─ / → Frontend SSR (:3000)
            └─ /api/* → Backend (:8000)
```

### Key Points
- **Frontend**: Node.js server that renders React pages (SSR)
- **Backend**: Python FastAPI serving `/api/*` endpoints
- **Development**: Vite proxy auto-forwards `/api/*` to backend
- **Production**: nginx combines both services (or use CORS)

⚠️ **The Vite dev proxy disappears in production!** You must use nginx or enable CORS.

For detailed production options, see `PRODUCTION_API_COMMUNICATION.md`.

---

## Alternative: CORS Setup (No nginx)

If you don't want to use nginx, enable CORS in the backend:

**Edit `pocket-dev-guild/pocket_dev_guild/app.py`:**
```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(...)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then access frontend and backend on separate ports:
- Frontend: `http://yourdomain.com:3000`
- Backend: `http://yourdomain.com:8000`

---

## Docker Deployment

Create `docker-compose.yml`:
```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on: [frontend, backend]

  frontend:
    build: ./remix-of-frontend-guild-prep
    environment:
      - NODE_ENV=production

  backend:
    build: ./pocket-dev-guild
    volumes:
      - ./repos:/app/repos
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| API calls return 404 | Merge PR #4 (adds `/api` prefix to backend) |
| CORS errors | Use nginx reverse proxy OR enable CORS in backend |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Build errors | `rm -rf node_modules dist && npm install && npm run build` |

---

## Common Mistakes ❌

- ❌ Don't copy `dist/client/*` to `pocket-dev-guild/static/`
- ❌ Don't commit built files (`dist/`) to git
- ❌ Don't expect static file serving to work (TanStack Start is SSR!)
- ❌ Don't deploy without merging PR #4 first

---

## Additional Resources

- **`PRODUCTION_API_COMMUNICATION.md`** - Detailed guide on API communication in production
- **`INTEGRATION_PLAN.md`** - Architecture analysis and options
- **TanStack Start docs**: https://tanstack.com/start/latest
