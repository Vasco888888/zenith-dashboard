import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Bar, Legend
} from 'recharts';

function App() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [candleData, setCandleData] = useState(null);
  const [error, setError] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [timeRange, setTimeRange] = useState('1M');
  const [chartType, setChartType] = useState('area');
  const [loading, setLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const POPULAR_STOCKS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'AMD'];


  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);


  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [watchlist]);


  useEffect(() => {
    if (!isSearching || ticker.length < 2) {
      setSearchResults([]);
      return;
    }
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/search/${ticker}`);
        const results = response.data.data || [];
        const uniqueResults = results.filter((item, index, self) =>
          index === self.findIndex(t => t.symbol === item.symbol)
        ).slice(0, 5);
        setSearchResults(uniqueResults);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [ticker, isSearching]);

  const fetchStock = async (symbol, range = null) => {
    if (!symbol) return;
    const selectedRange = range || timeRange;
    setLoading(true);
    setError(null);
    setIsSearching(false);
    setTicker(symbol);
    setSearchResults([]);

    try {
      const [stockResponse, candlesResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/stock/${symbol}?range=${selectedRange}`),
        axios.get(`http://localhost:5000/api/candles/${symbol}?range=${selectedRange}`)
      ]);

      if (!stockResponse.data || !stockResponse.data.price) {
        throw new Error('Invalid stock data');
      }

      setStockData(stockResponse.data);

      const candles = candlesResponse.data.values?.reverse().map(item => ({
        date: new Date(item.datetime).toLocaleDateString(),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume) || 0
      })) || [];
      setCandleData(candles);

      try {
        const fundResponse = await axios.get(`http://localhost:5000/api/fundamentals/${symbol}`);
        setFundamentals(fundResponse.data);
      } catch {
        setFundamentals(null);
      }

    } catch (err) {
      const errorCode = err.response?.data?.code;
      if (errorCode === 'RATE_LIMIT') {
        setError("API Rate Limit: Please wait a moment.");
      } else {
        setError("Unable to fetch stock data.");
      }
      setStockData(null);
      setCandleData(null);
      setFundamentals(null);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = (symbol) => {
    if (!watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const candlePriceRange = useMemo(() => {
    if (!candleData || candleData.length === 0) return { min: 0, max: 100 };
    const lows = candleData.map(d => d.low);
    const highs = candleData.map(d => d.high);
    return {
      min: Math.min(...lows),
      max: Math.max(...highs)
    };
  }, [candleData]);

  const CustomCandlestick = (props) => {
    const { x, y, width, background, payload } = props;
    if (!payload || payload.open === undefined) return null;

    const { open, close, high, low } = payload;
    const isGreen = close >= open;
    const color = isGreen ? '#10b981' : '#ef4444';


    const chartHeight = background?.height || 400;
    const chartY = background?.y || 0;
    const priceMin = candlePriceRange.min;
    const priceMax = candlePriceRange.max;
    const priceRange = priceMax - priceMin || 1;
    const scale = chartHeight / priceRange;
    const priceToY = (price) => chartY + (priceMax - price) * scale;

    const wickTop = priceToY(high);
    const wickBottom = priceToY(low);
    const bodyTop = priceToY(Math.max(open, close));
    const bodyBottom = priceToY(Math.min(open, close));
    const bodyHeightScaled = Math.max(bodyBottom - bodyTop, 1);
    const xCenter = x + width / 2;
    const candleWidth = Math.max(width * 0.5, 4);

    return (
      <g>
        <line x1={xCenter} y1={wickTop} x2={xCenter} y2={wickBottom} stroke={color} strokeWidth={1} />
        <rect x={xCenter - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeightScaled} fill={color} />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3 rounded-[var(--radius-md)] shadow-xl min-w-[140px]">
          <p className="text-[var(--text-secondary)] text-xs mb-2 border-b border-[var(--border-subtle)] pb-1">{label}</p>
          <div className="flex flex-col gap-1 text-sm font-mono">
            {data.open !== undefined ? (
              <>
                <div className="flex justify-between items-center gap-3"><span className="text-[var(--text-tertiary)]">Open:</span> <span className="text-[var(--text-primary)]">${data.open.toFixed(2)}</span></div>
                <div className="flex justify-between items-center gap-3"><span className="text-[var(--text-tertiary)]">High:</span> <span className="text-emerald-500">${data.high.toFixed(2)}</span></div>
                <div className="flex justify-between items-center gap-3"><span className="text-[var(--text-tertiary)]">Low:</span> <span className="text-red-500">${data.low.toFixed(2)}</span></div>
                <div className="flex justify-between items-center gap-3"><span className="text-[var(--text-tertiary)]">Close:</span> <span className="text-[var(--brand-primary)]">${data.close.toFixed(2)}</span></div>
              </>
            ) : (
              <div className="flex justify-between items-center gap-3"><span className="text-[var(--text-tertiary)]">Price:</span> <span className="text-[var(--brand-primary)]">${data.price?.toFixed(2)}</span></div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] font-sans selection:bg-[var(--brand-primary)] selection:text-black">
      <div className="relative z-10 max-w-[1400px] mx-auto p-6 md:p-12">


        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--brand-primary)] flex items-center justify-center text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">ZENITH</h1>
              <p className="text-[var(--text-secondary)] text-sm font-medium">Real-Time Financial Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a href="https://github.com/Vasco888888" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Vasco888888
            </a>
          </div>
        </header>


        <div className="relative mb-12 z-40">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search ticker (e.g. AAPL, NVDA)"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                  setIsSearching(true);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                onKeyDown={(e) => e.key === 'Enter' && fetchStock(ticker)}
                className="input-base text-lg py-4 pl-6"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>


              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden shadow-2xl z-50">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      onClick={() => fetchStock(result.symbol)}
                      className="p-4 hover:bg-[var(--border-subtle)] cursor-pointer flex justify-between items-center group transition-colors"
                    >
                      <div>
                        <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] mr-3">{result.symbol}</span>
                        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{result.instrument_name}</span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-card)] text-[var(--text-secondary)]">{result.exchange}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => fetchStock(ticker)}
              disabled={loading}
              className="btn-primary w-32 text-lg"
            >
              {loading ? <div className="spinner" /> : 'Search'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock}
                onClick={() => fetchStock(stock)}
                className="tag-pill hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] cursor-pointer"
              >
                {stock}
              </button>
            ))}
          </div>
        </div>


        {watchlist.length > 0 && (
          <div className="mb-12 glass-panel p-6 rounded-[var(--radius-lg)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-[var(--brand-primary)] rounded-[var(--radius-sm)]"></span>
              Watchlist
            </h2>
            <div className="flex flex-wrap gap-3">
              {watchlist.map((symbol) => (
                <div key={symbol} className="flex items-center gap-3 pl-4 pr-2 py-2 bg-[var(--surface-elevated)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] group transition-colors">
                  <button onClick={() => fetchStock(symbol)} className="font-mono font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]">
                    {symbol}
                  </button>
                  <button onClick={() => removeFromWatchlist(symbol)} className="text-[var(--text-tertiary)] hover:text-[var(--error)] p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        {error && (
          <div className="mb-8 p-4 bg-[var(--surface-elevated)] border-l-4 border-[var(--error)] text-[var(--error)] rounded-[var(--radius-md)]">
            {error}
          </div>
        )}


        {stockData && (
          <div className="stock-card">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-8 mb-10 border-b border-[var(--border-subtle)] pb-8">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-[var(--text-primary)]">{stockData.symbol}</h2>
                  <button
                    onClick={() => watchlist.includes(stockData.symbol) ? removeFromWatchlist(stockData.symbol) : addToWatchlist(stockData.symbol)}
                    className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center transition-all ${watchlist.includes(stockData.symbol) ? 'bg-[var(--brand-primary)] text-black' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]'}`}
                  >
                    <svg className="w-5 h-5" fill={watchlist.includes(stockData.symbol) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-4 items-baseline">
                  <span className="text-4xl font-mono mobile-numbers font-medium text-[var(--brand-primary)]">${stockData.price.toFixed(2)}</span>
                  <span className={`text-lg font-medium px-2 py-0.5 rounded-[var(--radius-sm)] ${stockData.percentChange >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {stockData.percentChange > 0 ? '+' : ''}{stockData.percentChange.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex p-1 bg-[var(--surface-elevated)] rounded-[var(--radius-md)] gap-1">
                  {['area', 'candlestick'].map(type => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={`px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] capitalize transition-all ${chartType === type ? 'bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex p-1 bg-[var(--surface-elevated)] rounded-[var(--radius-md)] gap-1">
                  {['1W', '1M', '3M', '6M', '1Y'].map(range => (
                    <button
                      key={range}
                      onClick={() => { setTimeRange(range); fetchStock(stockData.symbol, range); }}
                      className={`px-3 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-all ${timeRange === range ? 'bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[450px] w-full mb-10">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={stockData.history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={['auto', 'auto']} stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="price" stroke="var(--brand-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                  </AreaChart>
                ) : (
                  <ComposedChart data={candleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={['auto', 'auto']} stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Bar dataKey="high" shape={<CustomCandlestick />} isAnimationActive={false} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            {fundamentals && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Market Cap', value: fundamentals.statistics?.valuations_metrics?.market_capitalization, prefix: '$', format: true },
                  { label: 'P/E Ratio', value: fundamentals.statistics?.valuations_metrics?.pe_ratio },
                  { label: '52W High', value: fundamentals.statistics?.stock_price_summary?.fifty_two_week_high, prefix: '$', color: 'text-emerald-500' },
                  { label: '52W Low', value: fundamentals.statistics?.stock_price_summary?.fifty_two_week_low, prefix: '$', color: 'text-red-500' },
                ].map((stat, i) => stat.value && (
                  <div key={i} className="stat-card">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className={`text-xl font-mono font-medium ${stat.color || 'text-[var(--text-primary)]'}`}>
                      {stat.prefix}{stat.format ? formatNumber(stat.value) : parseFloat(stat.value).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {!stockData && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
            <div className="w-24 h-24 mb-6 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--text-secondary)]">No Data Loaded</h3>
            <p className="text-[var(--text-tertiary)] max-w-sm mt-2">Enter a ticker symbol above or select a trending stock to begin your analysis.</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;