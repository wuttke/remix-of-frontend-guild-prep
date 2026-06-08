# Pocket Dev Guild Frontend

Frontend für die Pocket Dev Guild - ein Tool zum Verwalten von Git Worktrees und Augment Agent Sessions.

## Entwicklung

### Installation

```bash
npm install --legacy-peer-deps
```

### Dev-Server starten

```bash
npm run dev
```

Der Dev-Server läuft auf `http://localhost:8080`

### Mock-Modus vs. Live-Modus

Das Frontend kann in zwei Modi laufen:

#### Mock-Modus (Standard)
- Nutzt In-Memory Mock-Daten
- Kein Backend benötigt
- Ideal für UI-Entwicklung

```bash
# .env
VITE_USE_MOCK_DATA=true
```

#### Live-Modus
- Verbindet sich mit dem echten Backend über `/api`
- Backend muss auf `localhost:8000` laufen
- Vite proxied `/api/*` → `http://localhost:8000/*`

```bash
# .env
VITE_USE_MOCK_DATA=false
```

### Backend starten (für Live-Modus)

Das Backend liegt unter `~/repositories/pocket-dev-guild/`:

```bash
cd ~/repositories/pocket-dev-guild
uvicorn main:app --reload --port 8000
```

## Build

```bash
npm run build
```

Build-Output: `dist/`

## Technologie-Stack

- **Framework**: TanStack Start (SSR React Framework)
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Build Tool**: Vite
