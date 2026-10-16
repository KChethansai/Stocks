# MarketForge — Paper Trading Simulator

A full-stack MERN paper trading simulator that lets users practice stock trading with **$100,000 in virtual money** using real-time market data powered by Yahoo Finance — plus ML-powered price predictions, automated trading jobs, and price alerts. Built with Express 5, MongoDB, React 19, and Zustand.

---

## Features

- **Real-Time Stock Data** — 30 major US stocks synced via `yahoo-finance2` across Technology, Healthcare, Finance, Energy, and more
- **Paper Trading** — Buy and sell stocks with virtual balance; trades are atomic (MongoDB transactions on Atlas, per-user serialized queue otherwise)
- **ML Price Predictions** — Next-day direction/confidence for every symbol. Python (XGBoost → ONNX) training pipeline with an always-on JS fallback predictor (`Backend/ml/`)
- **Accuracy Tracking** — Cron-driven resolution of past predictions (`ACCURACY_RESOLVE_CRON`) plus a live accuracy dashboard
- **Automated Trading** — Run paper-trading strategies on a schedule (`AUTOMATION_INTERVAL_CRON`, per-day trade cap configurable)
- **Price Alerts** — Get notified when a symbol crosses a target price
- **Portfolio Tracking** — Holdings, average cost, P&L, and portfolio value with a real equity curve
- **Transaction History** — Full log of every buy/sell with CSV export
- **Market Analytics** — Interactive terminal-style charts, market cap summary, top gainers & losers
- **Watchlist** — Save and track stocks of interest
- **User Auth** — JWT cookie-based authentication + Google OAuth 2.0 sign-in
- **Profile Management** — Update username, password, and profile picture (Cloudinary)
- **Security** — Helmet, rate limiting, CORS allowlist + origin guard, HTTP-only cookies, magic-byte upload validation, noSQL-injection payload rejection

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| Express 5 | HTTP server & routing |
| Mongoose 9 | MongoDB ODM |
| `yahoo-finance2` | Live stock price data |
| `jsonwebtoken` | JWT auth |
| `bcryptjs` | Password hashing |
| `google-auth-library` | Google OAuth token verification |
| `cloudinary` + `multer` | Profile image uploads |
| `node-cron` | Automation jobs & accuracy resolution |
| `helmet` | HTTP security headers |
| `express-rate-limit` | API rate limiting |
| `compression` | Response compression |

### Frontend
| Package | Purpose |
|---|---|
| React 19 | UI framework |
| React Router 7 | Client-side routing |
| Zustand 5 | Global state management |
| Tailwind CSS 4 | Styling |
| `react-hook-form` | Form handling |
| `react-hot-toast` | Notifications |
| `@react-oauth/google` | Google sign-in button |
| Vite 8 | Build tool |

---

## Project Structure

```
Stocks/
├── Backend/
│   ├── APIs/
│   │   ├── UserAPI.js          # Auth, profile, watchlist routes
│   │   ├── StockAPI.js         # Stock listing, sync & OHLC history
│   │   ├── TradeAPI.js         # Buy/sell, portfolio, transactions
│   │   ├── MarketAPI.js        # Market summary, gainers & losers
│   │   └── MlAPI.js            # Predictions, automation, alerts, accuracy
│   ├── config/
│   │   ├── cloudinary.js       # Cloudinary setup
│   │   ├── env.js              # Environment variable validation
│   │   ├── multer.js           # File upload config
│   │   └── security.js         # Helmet, rate limits, origin guard
│   ├── controllers/
│   │   └── googleAuthController.js
│   ├── middlewares/
│   │   └── verifyToken.js      # JWT HOF middleware
│   ├── ml/
│   │   ├── features.js         # Feature engineering for predictions
│   │   ├── predictor.js        # JS fallback predictor
│   │   ├── trainedPredictor.js # ONNX model loader (optional)
│   │   ├── accuracyResolver.js # Cron resolution of past predictions
│   │   ├── automationJob.js    # Scheduled paper-trading strategies
│   │   ├── history.js          # Historical price featurization
│   │   ├── selfcheck.js        # Model health checks
│   │   └── python/             # XGBoost → ONNX training pipeline
│   ├── models/
│   │   ├── UserModel.js
│   │   ├── StockModel.js
│   │   ├── PortfolioModel.js
│   │   ├── OrderModel.js
│   │   ├── TransactionModel.js
│   │   ├── HistoryModel.js
│   │   ├── AlertModel.js
│   │   ├── AutomationRuleModel.js
│   │   └── PredictionLogModel.js
│   ├── services/
│   │   └── tradeService.js     # Atomic buy/sell engine
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── Frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ml/             # Accuracy panel, prediction widgets
    │   │   ├── ui/             # Button, BuyButton, Stepper, Select…
    │   │   ├── layout/         # Sidebar, header, root layout
    │   │   ├── magicui/ kokonutui/ reactbits/ 3d/   # Motion kit components
    │   │   └── *.jsx           # Pages & feature components
    │   ├── store/
    │   │   ├── authStore.js    # Auth & user state (Zustand)
    │   │   └── tradeStore.js   # Portfolio & trading state (Zustand)
    │   ├── utils/
    │   │   ├── csvExport.js    # Transaction CSV download
    │   │   └── marketAnalytics.js
    │   └── App.jsx             # Router config with lazy loading
    ├── package.json
    └── .env.example
```

---

## Getting Started

### Prerequisites

- Node.js 22 LTS (Vite 8 requires Node ≥ 20.19; `node --version` to check)
- MongoDB Atlas account on a replica set (paper-trade fills use multi-document transactions)
- Cloudinary account (avatar uploads; the app runs without it, uploads return 503)
- Google OAuth 2.0 Client ID (for Google sign-in; optional — the button hides gracefully without it)
- Python 3.11+ only if you retrain ML models (`Backend/ml/python`)

### 1. Clone the Repository

```bash
git clone https://github.com/KChethansai/Stocks.git
cd Stocks
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in your values:

```env
DB_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/marketforge?retryWrites=true&w=majority
PORT=4000
SECRET_KEY=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173,https://your-frontend.vercel.app
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Start the backend:

```bash
# Development (with file watching)
npm run dev

# Production
npm start
```

### 3. Frontend Setup

```bash
cd ../Frontend
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Quality Gates (run before any release)

```bash
cd Frontend
npm run lint            # 0 errors required
npm run tokens:check    # design-token gate (JSX + CSS), must print clean
npm run test:unit       # history-cache policy unit tests (node --test)
npm run build && npm run preview
cd ../Backend
npm run test:unit       # toProviderTime + seed-guard + seed failure-branch tests
node scripts/verifyPhase0.js   # 13/13 gates; see warning below
```

### 5. Tests — Regression vs Live-Provider

| Command | What it proves | Network / DB |
|---|---|---|
| `Backend: npm run test:unit` | Timestamp normalization, seed-guard refusals, seed failure branches (stubbed provider — deterministic) | Offline, no DB |
| `Backend: node scripts/verifyPhase0.js` | Trading safeguards on an isolated DB (idempotency, quote gating, reconciliation) | Needs `DB_URL`; see warning |
| `Frontend: npm run e2e` (= `sh scripts/e2e.sh --project=chromium-desktop`) | Full browser regression, serialized with `flock` — never run bare `npx playwright test` concurrently (concurrent runs corrupt artifacts and caused the Oct 2026 trace flakes) | Needs test backend + dev server below |
| Live-provider smoke | Seed + suite against real Yahoo data | Test DB only |

> ⚠️ `verifyPhase0` derives an isolated `phase0test_*` database on the **same
> cluster** as `DB_URL` and **drops it** when done (drop scope is asserted
> before deletion). Point `DB_URL` at a test cluster first — never run it
> against the production connection string.

### 6. Isolated Test Database (never production)

All browser tests run against a throwaway database. The seed script refuses
anything that does not look isolated, refuses the application's own `DB_URL`
database, and never fabricates prices (unreachable symbols are marked
`source:'seed'`/`stale:true`, never written as Yahoo data):

```bash
# 1. Seed verified quotes + history from live Yahoo (exit 2 = some symbols marked stale)
cd Backend
PWTEST_DB_URL=<isolated mongo url with "test" in the db name> node scripts/seedPwTest.js

# 2. Backend on the isolated DB (from the Backend directory)
DB_URL="<same isolated url>" PORT=4101 AUTH_RATE_LIMIT_MAX=1000 node server.js

# 3. Frontend against it (from the Frontend directory, second terminal).
# Blank VITE_GOOGLE_CLIENT_ID for hermetic runs: a real ID loads Google's
# third-party GSI script, which races form clicks on Firefox in sandboxes.
VITE_API_URL=http://localhost:4101 VITE_GOOGLE_CLIENT_ID= npx vite --port 5173

# 4. Suite (from the Frontend directory, third terminal)
npm run e2e
```

Test credentials are generated per run (`*-<timestamp>@example.com`); no
real credentials or database URLs belong in logs or committed artifacts.

---

## API Routes

### User (`/user-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register with optional profile image |
| POST | `/login` | — | Login, sets JWT cookie |
| POST | `/logout` | — | Clears auth cookie |
| GET | `/profile` | ✅ | Get current user profile |
| PUT | `/profile` | ✅ | Update username / profile image |
| PUT | `/password` | ✅ | Change password |
| GET | `/watchlist` | ✅ | Get watchlist symbols |
| POST | `/watchlist` | ✅ | Add symbol to watchlist |
| DELETE | `/watchlist/:symbol` | ✅ | Remove symbol from watchlist |

### Stock (`/stock-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/stocks` | ✅ | List all 30 tracked stocks |
| GET | `/stocks/:symbol` | ✅ | Single stock details |
| GET | `/history/:symbol?interval=1d\|60m` | — | OHLC candles (24h / 15m cache) |
| POST | `/stocks/seed` | ✅ | Manual Yahoo sync (throttled to 5 min) |

### Trade (`/trade-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/buy` | ✅ | Buy shares (atomic transaction) |
| POST | `/sell` | ✅ | Sell shares (atomic transaction) |
| GET | `/portfolio` | ✅ | Holdings with live P&L |
| GET | `/performance` | ✅ | Portfolio equity curve |
| GET | `/transactions` | ✅ | Full trade history |
| GET | `/orders` | ✅ | Order history |

### ML (`/ml-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/predict/:symbol` | — | Next-day price prediction |
| GET | `/predict` | — | Predictions for all symbols |
| GET | `/automation` | ✅ | List automation rules |
| POST | `/automation` | ✅ | Create an automation rule |
| DELETE | `/automation/:symbol` | ✅ | Remove an automation rule |
| GET | `/alerts` | ✅ | List price alerts (unread by default, `?includeRead=true`) |
| PATCH | `/alerts/:id/read` | ✅ | Mark an alert as read |
| GET | `/accuracy/:symbol?limit=` | ✅ | Prediction accuracy for a symbol |
| GET | `/accuracy` | ✅ | Global accuracy summary |
| POST | `/accuracy/resolve-now` | ✅ | Force-resolve outstanding predictions |

### Market (`/market-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/summary` | — | Market cap total, top 5 gainers & losers |

### Google Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/google` | Verify Google OAuth credential, issue JWT |

---

## Deployment

### Backend — Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node server.js`
4. Add all environment variables from `.env.example` under **Environment**
5. Set `NODE_ENV=production`

### Frontend — Vercel

1. Import the `Frontend` folder into [Vercel](https://vercel.com)
2. Set **Framework Preset**: Vite
3. Add environment variables: `VITE_API_URL=https://your-backend.onrender.com`, `VITE_GOOGLE_CLIENT_ID=<id>` (optional)
4. The included `vercel.json` handles SPA routing rewrites automatically

### Order + Rollback

Deploy in this order — the backend allowlist must know the frontend origin:

1. Deploy backend → note its URL → set `CLIENT_URLS` to include the Vercel URL → redeploy backend.
2. Deploy frontend → smoke-test `/ml-api/accuracy` and one paper trade on the
   production URL (verifies `CLIENT_URLS`, cookies, and `NODE_ENV=production`).
3. Rollback: **app** — Render/Vercel dashboard revert to the previous deploy
   (stateless; no migration to reverse). **Model** — `npm run release:rollback
   && npm run release:verify` from `Backend/`.
   App rollback and model rollback are independent operations: reverting the
   app never touches model bundles, and rolling back a model never touches
   deployed code. Do them separately, verify each separately.

### Database compatibility (all included changes)

New fields are strictly additive and optional — no migration script, no
downtime, rollback-safe:
- `Stock`: `source` (default `'unverified'`), `asOf`/`providerTime`/
  `lastVerifiedAt` (default `null`), `stale` (default `false`).
- `Order`/`Transaction`: `idempotencyKey` (default `undefined`, indexed).
- `PredictionLog`: `model`/`releaseId`/`modelVersion`/`provenance`/`status`/
  `resolutionReason`/`asOf`/`priceProvenance` (defaults `null`/`'unknown'`;
  pre-existing rows read back as legacy/unknown, never relabeled).
- New collection `idempotencyKey` with unique `(userId, key)` index and a
  24h TTL (`expireAfterSeconds`) — replay windows self-clean.
- New indexes (`Order`/`Transaction` user+symbol+createdAt,
  `PredictionLog` status/releaseId composites, `Alert`/`PriceAlert`/
  `AutomationRule` compounds) are created automatically by Mongoose on
  connect; on the small MarketForge collections the build cost is negligible.
- Backward compatibility: old documents remain valid (defaults apply on
  read); new documents under an old app version are ignored-field-safe
  (Mongoose strict mode neither reads nor destroys unknown fields on
  plain reads). Rollback limitation: rolling the app back does NOT remove
  new fields/indexes — that is intentional and harmless; re-deploying
  forward picks them back up with zero repair.

### Production smoke-test checklist (run after every deploy)

Use a dedicated test account (e.g. `smoke-<date>@example.com`), never a real
user's account. All money is virtual; ledger entries from smoke trades persist
by design — keep quantities at 1 share.

1. **Public data**: open `/` — hero ticket + fund chart render with genuine
   values; scroll to markets/analytics sections; `GET /stock-api/stocks`
   returns 30 symbols with fresh `asOf`.
2. **Login/session persistence**: log in → hard-reload → still authenticated
   (cookie `Secure` + `SameSite=None` over HTTPS; `lax` only in dev).
   Log out → `/dashboard` redirects to `/login`.
3. **Profile saving**: change username → reload → persisted; avatar upload
   optional (503 without Cloudinary config is expected, not a failure).
4. **Dedicated-account paper trade**: buy 1 share of AAPL → receipt shows →
   `/activity` lists it → sell 1 share → balances reconcile.
5. **Google button (if `VITE_GOOGLE_CLIENT_ID` set)**: button renders on
   `/login`; a consent-completed sign-in lands on `/dashboard`. Requires the
   production URL in Google Cloud Console → Credentials → OAuth client →
   **Authorized JavaScript origins** (same client ID in backend
   `GOOGLE_CLIENT_ID` and frontend `VITE_GOOGLE_CLIENT_ID`).
6. **ML**: `GET /ml-api/accuracy` 200; one `/predict/AAPL` returns
   direction + basis (never a percentage claim).

The pre-redesign landing is archived byte-identical with restoration steps in
`Frontend/src/legacy-landing/README.md` (never bundled — verified 0 bytes in
the production build).

After deploying both, update `CLIENT_URLS` in your Render backend env to include your Vercel frontend URL.

---

## Environment Variables Reference

### Backend

| Variable | Description |
|---|---|
| `DB_URL` | MongoDB Atlas connection string |
| `PORT` | Server port (default: 4000) |
| `SECRET_KEY` | JWT signing secret |
| `CLIENT_URL` | Primary frontend URL (dev) |
| `CLIENT_URLS` | Comma-separated allowed origins (prod) |
| `NODE_ENV` | `development` or `production` |
| `COOKIE_SAME_SITE` | Cookie SameSite attribute (defaults: lax dev / none prod) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `AUTOMATION_INTERVAL_CRON` | Cron schedule for automation jobs (default: `*/15 * * * *`) |
| `ACCURACY_RESOLVE_CRON` | Cron schedule for accuracy resolution (default: `30 21 * * 1-5`) |
| `MAX_AUTOMATION_TRADES_PER_DAY` | Daily cap for automated trades per user |
| `ML_DEMO_MODE` | **Never `true` in production** — demo accuracy is force-disabled when `NODE_ENV=production`, but leave it unset to avoid confusion |
| `ML_AUTOMATION_ALLOW_HEURISTIC` | Opt-in to allow BUY/SELL on heuristic fallback (default blocked) |
| `ML_AUTOMATION_ALLOW_EXPERIMENTAL` | Opt-in to allow BUY/SELL on experimental v2 models (default blocked) |
| `ML_QUOTE_MAX_AGE_MINUTES` | Quote freshness for prediction-driven trades (default 5760 = 4 days) |
| `ACCURACY_UNRESOLVABLE_AFTER_DAYS` | Zero-candle logs older than this are marked unresolvable (default 30) |
| `AUTH_RATE_LIMIT_MAX` | Test-only escape hatch for the isolated audit backend (production default 20) — never raise in production |

> Production cookies require `COOKIE_SAME_SITE=none` **plus HTTPS**; the
> default is `lax` in development and `none` in production.

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (optional; Google button shows a disabled notice without it) |

---

## Author

**K Chethan Sai** — Roll No: 24EG110A17  
GitHub: [@KChethansai](https://github.com/KChethansai)