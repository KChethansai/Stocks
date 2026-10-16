# MarketForge frontend (Vite 8 + React 19)

See the root `README.md` for full setup, test-database isolation, quality
gates, and deployment. Quick reference:

```bash
npm install
cp .env.example .env   # needs VITE_API_URL; VITE_GOOGLE_CLIENT_ID optional
npm run dev            # http://localhost:5173
npm run lint && npm run tokens:check && npm run test:unit
npm run build && npm run preview
npm run e2e            # full Chromium regression (serialized; needs test backend on :4101)
```
