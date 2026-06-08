# Pocket Dev Guild Frontend

Frontend für die Pocket Dev Guild - ein Tool zum Verwalten von Git Worktrees und Augment Agent Sessions.

**📖 [Deployment Guide](DEPLOYMENT.md)** - Setup für Development & Production

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

Das Frontend kann in zwei Modi laufen. Die Auswahl passiert über die Env-Variable
`VITE_USE_MOCK_DATA`. **Default ist Mock** — nur wenn der Wert exakt `"false"`
ist, wird der echte Backend-Client benutzt.

#### Mock-Modus (Default, Lovable-Preview)

- Keine `.env`-Datei nötig
- Nutzt In-Memory Mock-Daten aus `src/lib/pdg/mock-data.ts`
- So läuft auch die Lovable-Preview, weil dort keine `.env`/`.env.local` existiert

#### Live-Modus (lokal, gegen echtes Backend)

Lege einmalig eine **`.env.local`** an (ist in `.gitignore`, wird nie nach
Lovable übertragen):

```bash
# .env.local
VITE_USE_MOCK_DATA=false
```

Vite proxied dann `/api/*` → `http://localhost:8000/api/*` (siehe `vite.config.ts`).

### Backend starten (für Live-Modus)

Das Backend liegt unter `~/repositories/pocket-dev-guild/`:

```bash
cd ~/repositories/pocket-dev-guild
uvicorn main:app --reload --port 8000
```

## Build & Deployment

```bash
npm run build        # Production build
npm run preview      # Test production build locally
```

Build-Output: `dist/client/` (assets) + `dist/server/` (SSR server)

⚠️ **TanStack Start ist SSR** - nicht als statische Dateien deploybar!
Siehe **[DEPLOYMENT.md](DEPLOYMENT.md)** für Production-Setup (nginx, CORS, etc.)

## Technologie-Stack

- **Framework**: TanStack Start (SSR React Framework)
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Build Tool**: Vite
