import React, { useEffect, useRef, useState } from "react";
import { Activity, Bell, CalendarDays, ChartCandlestick, Gauge, Newspaper, Settings, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

const money = v => v == null ? "--" : Number(v).toFixed(2);
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = async path => {
  const r = await fetch(`${API_BASE}${path}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "API error");
  return d;
};

function TradingViewChart({ signal }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "tradingview-widget-container";
    wrap.style.width = "100%";
    wrap.style.height = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.width = "100%";
    widget.style.height = "100%";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "OANDA:XAUUSD",
      interval: "15",
      timezone: "Asia/Phnom_Penh",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    wrap.appendChild(widget);
    wrap.appendChild(script);
    ref.current.appendChild(wrap);

    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, []);

  return (
    <div className="chart-wrap">
      <div className="chart-badge">
        <span className={signal?.type === "BUY" ? "dot buy-dot" : signal?.type === "SELL" ? "dot sell-dot" : "dot"} />
        {signal?.type || "WAIT"} • Analysis {signal?.confidence ?? "--"}%
      </div>
      <div className="tv-chart" ref={ref} />
      {signal && signal.type !== "WAIT" && (
        <div className="levels-overlay">
          <div><span>ENTRY</span><b>{money(signal.entry)}</b></div>
          <div className="tp"><span>TP1</span><b>{money(signal.tp1)}</b></div>
          <div className="tp"><span>TP2</span><b>{money(signal.tp2)}</b></div>
          <div className="tp"><span>TP3</span><b>{money(signal.tp3)}</b></div>
          <div className="sl"><span>SL</span><b>{money(signal.sl)}</b></div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [analysis, setAnalysis] = useState(null);
  const [price, setPrice] = useState(null);
  const [interval, setInterval] = useState("15min");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [a, p] = await Promise.all([
        api(`/api/analysis?interval=${interval}`),
        api("/api/price")
      ]);
      setAnalysis(a);
      setPrice(p);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [interval]);

  const buy = analysis?.type === "BUY";
  const sell = analysis?.type === "SELL";

  return (
    <div className="app">
      <aside>
        <div className="brand"><div className="logo">Au</div><div><b>GOLD PRO</b><small>TRADING TERMINAL</small></div></div>
        {[
          ["Dashboard", Gauge], ["Gold Market", ChartCandlestick], ["Signals", Activity],
          ["Analysis", TrendingUp], ["News", Newspaper], ["Calendar", CalendarDays],
          ["Risk Manager", ShieldAlert], ["Settings", Settings]
        ].map(([x, Icon], i) => <div className={`nav ${i===0?"active":""}`} key={x}><Icon size={18}/>{x}</div>)}
        <div className="side-note">TradingView + Real Data<br/>XAU/USD • Signal Engine</div>
      </aside>

      <main>
        <header>
          <div><span className="muted">LIVE MARKET</span><h1>XAU/USD</h1></div>
          <div className="top-price">${money(price?.price)} <span className="live">● LIVE</span></div>
          <button onClick={load}>Refresh</button>
          <Bell size={20}/>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="stats">
          <div className="stat"><span>Gold Price</span><strong>${money(price?.price)}</strong><small>Backend real-time quote</small></div>
          <div className="stat"><span>Signal</span><strong className={buy?"green":sell?"red":""}>{analysis?.type || "--"}</strong><small>{analysis?.confidence ?? "--"}% rule confidence</small></div>
          <div className="stat"><span>RSI (14)</span><strong>{money(analysis?.indicators?.rsi)}</strong><small>Momentum</small></div>
          <div className="stat"><span>ATR (14)</span><strong>{money(analysis?.indicators?.atr)}</strong><small>Volatility</small></div>
        </section>

        <section className="grid">
          <div className="panel chart-panel">
            <div className="panel-head">
              <div><b>TradingView — XAU/USD</b><small>Chart + live analytical levels</small></div>
              <select value={interval} onChange={e=>setInterval(e.target.value)}>
                <option value="5min">5m Analysis</option>
                <option value="15min">15m Analysis</option>
                <option value="1h">1H Analysis</option>
                <option value="4h">4H Analysis</option>
              </select>
            </div>
            <TradingViewChart signal={analysis}/>
          </div>

          <div className={`panel signal ${buy?"buy":sell?"sell":""}`}>
            <div className="signal-title">{buy?<TrendingUp/>:sell?<TrendingDown/>:<Activity/>}<span>SMART SIGNAL</span></div>
            <h2>{analysis?.type || "WAIT"}</h2>
            <div className="confidence">{analysis?.confidence ?? "--"}% rule confidence</div>
            <div className="levels">
              <div><span>Entry</span><b>{money(analysis?.entry)}</b></div>
              <div><span>TP1</span><b>{money(analysis?.tp1)}</b></div>
              <div><span>TP2</span><b>{money(analysis?.tp2)}</b></div>
              <div><span>TP3</span><b>{money(analysis?.tp3)}</b></div>
              <div className="sl"><span>Stop Loss</span><b>{money(analysis?.sl)}</b></div>
            </div>
            <div className="logic">
              <b>Signal logic</b>
              <span>EMA 20/50/200 • RSI • MACD • ATR</span>
            </div>
            <small className="disclaimer">Analytical output only. TP/SL are calculated from current volatility and rules; they are not guaranteed outcomes.</small>
          </div>
        </section>

        <section className="grid bottom">
          <div className="panel">
            <div className="panel-head"><b>Technical Analysis</b><span className="badge">LIVE</span></div>
            <div className="indicators">
              <div><span>EMA 20</span><b>{money(analysis?.indicators?.ema20)}</b></div>
              <div><span>EMA 50</span><b>{money(analysis?.indicators?.ema50)}</b></div>
              <div><span>EMA 200</span><b>{money(analysis?.indicators?.ema200)}</b></div>
              <div><span>MACD</span><b>{money(analysis?.indicators?.macd)}</b></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><b>System Connection</b><span className="badge green">ONLINE</span></div>
            <p className="muted">TradingView provides the interactive chart. The private backend market-data feed calculates the signal, Entry, TP and SL.</p>
            <p className="muted">Both feeds may have different update timing or data-source characteristics.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
export default App;
