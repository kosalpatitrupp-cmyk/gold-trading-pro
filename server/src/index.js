import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const SYMBOL = process.env.SYMBOL || "XAU/USD";
const TD = "https://api.twelvedata.com";

function requireKey(res) {
  if (!API_KEY) {
    res.status(500).json({
      error: "TWELVE_DATA_API_KEY is missing. Add it to server/.env"
    });
    return false;
  }
  return true;
}

async function td(endpoint, params = {}) {
  const url = new URL(`${TD}${endpoint}`);
  Object.entries({ ...params, apikey: API_KEY }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || `Twelve Data HTTP ${response.status}`);
  }
  return data;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    gains += Math.max(d, 0);
    losses += Math.max(-d, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function atr(candles, period = 14) {
  if (candles.length <= period) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function macd(values) {
  if (values.length < 35) return { macd: null, signal: null, histogram: null };
  const fast = 12, slow = 26, sig = 9;
  const macdSeries = [];
  for (let i = slow - 1; i < values.length; i++) {
    const f = ema(values.slice(0, i + 1), fast);
    const s = ema(values.slice(0, i + 1), slow);
    if (f !== null && s !== null) macdSeries.push(f - s);
  }
  const m = macdSeries.at(-1);
  const signal = ema(macdSeries, sig);
  return { macd: m, signal, histogram: m !== null && signal !== null ? m - signal : null };
}

function buildSignal(candles) {
  const closes = candles.map(c => c.close);
  const price = closes.at(-1);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const r = rsi(closes);
  const m = macd(closes);
  const a = atr(candles);

  let buyScore = 0, sellScore = 0;
  if (e20 !== null && e50 !== null) price > e20 ? buyScore++ : sellScore++;
  if (e20 !== null && e50 !== null) e20 > e50 ? buyScore++ : sellScore++;
  if (e50 !== null && e200 !== null) e50 > e200 ? buyScore++ : sellScore++;
  if (r !== null) r > 50 && r < 70 ? buyScore++ : r < 50 && r > 30 ? sellScore++ : null;
  if (m.histogram !== null) m.histogram > 0 ? buyScore++ : sellScore++;

  const type = buyScore > sellScore ? "BUY" : sellScore > buyScore ? "SELL" : "WAIT";
  const confidence = Math.round((Math.max(buyScore, sellScore) / 5) * 100);

  const risk = a || price * 0.002;
  const slDistance = risk * 1.2;
  const tp1Distance = risk * 1.0;
  const tp2Distance = risk * 1.8;
  const tp3Distance = risk * 2.6;

  let entry = price, sl = null, tp1 = null, tp2 = null, tp3 = null;
  if (type === "BUY") {
    sl = entry - slDistance; tp1 = entry + tp1Distance; tp2 = entry + tp2Distance; tp3 = entry + tp3Distance;
  } else if (type === "SELL") {
    sl = entry + slDistance; tp1 = entry - tp1Distance; tp2 = entry - tp2Distance; tp3 = entry - tp3Distance;
  }

  return {
    symbol: SYMBOL, type, confidence, entry, sl, tp1, tp2, tp3,
    indicators: { ema20: e20, ema50: e50, ema200: e200, rsi: r, macd: m.macd, macdSignal: m.signal, macdHistogram: m.histogram, atr: a },
    timestamp: new Date().toISOString()
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, symbol: SYMBOL }));

app.get("/api/price", async (_req, res) => {
  try {
    if (!requireKey(res)) return;
    const data = await td("/price", { symbol: SYMBOL });
    res.json({ symbol: SYMBOL, price: num(data.price), timestamp: new Date().toISOString() });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/candles", async (req, res) => {
  try {
    if (!requireKey(res)) return;
    const interval = req.query.interval || "15min";
    const outputsize = Math.min(Number(req.query.outputsize || 250), 500);
    const data = await td("/time_series", {
      symbol: SYMBOL, interval, outputsize, timezone: "Asia/Phnom_Penh", order: "ASC"
    });
    const values = (data.values || []).map(x => ({
      time: Math.floor(new Date(x.datetime).getTime() / 1000),
      open: num(x.open), high: num(x.high), low: num(x.low), close: num(x.close)
    })).filter(x => x.open !== null);
    res.json({ symbol: SYMBOL, interval, candles: values });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/analysis", async (req, res) => {
  try {
    if (!requireKey(res)) return;
    const interval = req.query.interval || "15min";
    const data = await td("/time_series", {
      symbol: SYMBOL, interval, outputsize: 250, timezone: "Asia/Phnom_Penh", order: "ASC"
    });
    const candles = (data.values || []).map(x => ({
      high: num(x.high), low: num(x.low), close: num(x.close)
    }));
    res.json(buildSignal(candles));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", () => console.log(`Gold Trading API running on port ${PORT}`));
