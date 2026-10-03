# Gold Trading Pro

Real XAU/USD dashboard for VS Code.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Market data: Twelve Data
- Charts: lightweight-charts
- Indicators: calculated locally from OHLC data

## Setup

1. Install Node.js 20+.
2. Open this folder in VS Code.
3. In `server/.env`, add your Twelve Data API key:
   `TWELVE_DATA_API_KEY=YOUR_KEY`
4. Open two terminals:

Terminal 1:
```bash
cd server
npm install
npm run dev
```

Terminal 2:
```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

The backend keeps the API key private. XAU/USD data is requested from Twelve Data's market-data API. The signal is an analytical rule, not a guarantee of future price movement.


## TradingView chart

The dashboard now embeds the official TradingView Advanced Chart widget using the `OANDA:XAUUSD` symbol. The widget is loaded from TradingView in the browser. Your Twelve Data key remains server-side for the independent signal calculation.


## Deployment

### Backend (Render)
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `TWELVE_DATA_API_KEY`, `SYMBOL=XAU/USD`

### Frontend (Vercel)
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com`
