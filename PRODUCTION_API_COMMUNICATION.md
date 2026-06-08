# Production API Communication Guide

## The Key Question: How does the frontend talk to the backend in production?

**Short Answer:** The Vite dev proxy **only works during `npm run dev`**. In production, you need nginx (recommended) or CORS.

---

## Development vs Production

### Development Mode ✅
```
Browser → http://localhost:3000/api/repos
            ↓ [Vite Dev Server Proxy]
          http://localhost:8000/api/repos ← Backend
```

**How it works:**
- Vite dev server intercepts all `/api/*` requests
- Forwards them to `http://localhost:8000`
- Configured in `vite.config.ts`
- No CORS issues (same-origin to the browser)

---

### Production Mode ❌ (Without nginx)
```
Browser → http://localhost:3000/api/repos
            ↓ [TanStack Start SSR Server]
          ❌ 404 Not Found
```

**Why it fails:**
- TanStack Start server doesn't have the Vite proxy
- It only renders React pages and serves static assets
- Backend is on different port → 404 or CORS error

---

## Production Solutions

### Option 1: nginx Reverse Proxy (RECOMMENDED) ⭐

**Architecture:**
```
Browser → nginx (:80)
            ├─ / → Frontend SSR (:3000)
            └─ /api/* → Backend (:8000)
```

**nginx config:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
    }
}
```

**Benefits:**
- ✅ Same origin (no CORS)
- ✅ Single URL for users
- ✅ Production-ready
- ✅ Can add SSL, auth, rate limiting

---

### Option 2: CORS Configuration

**In `pocket-dev-guild/pocket_dev_guild/app.py`:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Deployment:**
- Frontend: `http://yourdomain.com:3000`
- Backend: `http://yourdomain.com:8000`
- Browser connects to both with CORS

**Benefits:**
- ✅ Simple, no nginx needed

**Drawbacks:**
- ❌ Slower (preflight requests)
- ❌ Two ports to expose

---

### Option 3: Environment Variable

Make API URL configurable:

**Update `src/lib/pdg/client.ts`:**
```typescript
const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";
export const pdg = useMockData 
  ? makeMockClient() 
  : makeHttpClient(apiBaseUrl);
```

**Create `.env.production`:**
```bash
VITE_API_URL=https://api.yourdomain.com/api
```

---

## Current Code Behavior

Your `src/lib/pdg/client.ts` hardcodes:
```typescript
makeHttpClient("/api")  // Relative URL
```

This means:
- All API calls go to `/api/*` on the **same origin**
- In production without nginx → 404 errors
- **Solution:** Use nginx reverse proxy or enable CORS

---

## Recommended Setup

### Development:
```bash
# Terminal 1: Backend
cd ../pocket-dev-guild
uvicorn main:app --reload

# Terminal 2: Frontend (with Vite proxy)
npm run dev
```

### Production:
```bash
# Install nginx
sudo apt install nginx

# Create config (see above)
sudo nano /etc/nginx/sites-available/pocket-dev-guild
sudo ln -s /etc/nginx/sites-available/pocket-dev-guild /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Run services
# Terminal 1: Frontend
npm run build && npm run preview

# Terminal 2: Backend
cd ../pocket-dev-guild
uvicorn main:app
```

Access at: `http://yourdomain.com` (nginx routes to both services)
