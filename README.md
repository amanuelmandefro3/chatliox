# Chatliox

SaaS live chat platform. Businesses embed a chat widget on their site; their support team manages conversations from a real-time admin dashboard.

## Tech Stack

- **Backend** — FastAPI, SQLAlchemy 2 (async), PostgreSQL, Alembic
- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query

## Getting Started

### Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# fill in DATABASE_URL and SECRET_KEY

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | JWT signing secret |
| `ENVIRONMENT` | `development` or `production` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry (default `1440`) |

## Embedding the Widget

After registering, copy your widget key from the dashboard and add this to any webpage:

```html
<iframe
  src="https://your-domain.com/widget?key=YOUR_WIDGET_KEY"
  style="position:fixed;bottom:24px;right:24px;width:380px;height:560px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999"
  allow="clipboard-write">
</iframe>
```

## License

MIT
