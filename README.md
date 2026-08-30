# MarketForge — Paper Trading Simulator

A full-stack MERN paper trading simulator that lets users practice stock trading with **$100,000 in virtual money** using real-time market data powered by Yahoo Finance. Built with Express 5, MongoDB, React 19, and Zustand.

---

## Features

- **Real-Time Stock Data** — 30 major US stocks synced via `yahoo-finance2` across Technology, Healthcare, Finance, Energy, and more
- **Paper Trading** — Buy and sell stocks with virtual balance; all trades are atomic (MongoDB sessions)
- **Portfolio Tracking** — Holdings, average cost, P&L, and overall portfolio value at a glance
- **Transaction History** — Full log of every buy/sell with CSV export
- **Market Analytics** — Interactive terminal-style charts, market cap summary, top gainers & losers
- **Watchlist** — Save and track stocks of interest
- **User Auth** — JWT cookie-based authentication + Google OAuth 2.0 sign-in
- **Profile Management** — Update username, password, and profile picture (Cloudinary)
- **Security** — Helmet, rate limiting, CORS allowlist, HTTP-only cookies

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
Stocks-main/
├── Backend/
│   ├── APIs/
│   │   ├── UserAPI.js          # Auth, profile, watchlist routes
│   │   ├── StockAPI.js         # Stock listing & Yahoo Finance sync
│   │   ├── TradeAPI.js         # Buy/sell with MongoDB transactions
│   │   └── MarketAPI.js        # Market summary, gainers & losers
│   ├── config/
│   │   ├── cloudinary.js       # Cloudinary setup
│   │   ├── env.js              # Environment variable validation
│   │   ├── multer.js           # File upload config
│   │   ├── security.js         # Cookie options
│   │   └── uploadToCloudinary.js
│   ├── controllers/
│   │   └── googleAuthController.js
│   ├── middlewares/
│   │   └── verifyToken.js      # JWT HOF middleware
│   ├── models/
│   │   ├── UserModel.js
│   │   ├── StockModel.js
│   │   ├── PortfolioModel.js
│   │   ├── OrderModel.js
│   │   ├── TransactionModel.js
│   │   └── HistoryModel.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── Frontend/
    ├── src/
    │   ├── components/         # All page and UI components
    │   ├── store/
    │   │   ├── authStore.js    # Auth & user state (Zustand)
    │   │   └── tradeStore.js   # Portfolio & trading state (Zustand)
    │   ├── styles/
    │   │   └── common.js       # All Tailwind tokens & class names
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

- Node.js v18+
- MongoDB Atlas account
- Cloudinary account
- Google OAuth 2.0 Client ID (for Google sign-in)

### 1. Clone the Repository

```bash
git clone https://github.com/KChethansai/ATP_24EG110A17.git
cd Stocks-main
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
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

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
| GET | `/stock/:symbol` | ✅ | Get single stock details + history |

### Trade (`/trade-api`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/buy` | ✅ | Buy shares (atomic transaction) |
| POST | `/sell` | ✅ | Sell shares (atomic transaction) |

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
3. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com`
4. The included `vercel.json` handles SPA routing rewrites automatically

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
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |

---

## Author

**K Chethan Sai** — Roll No: 24EG110A17  
GitHub: [@KChethansai](https://github.com/KChethansai)
