import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Bar, Line, Legend
} from 'recharts';

function App() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [candleData, setCandleData] = useState(null);
  const [error, setError] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [timeRange, setTimeRange] = useState('30');
  const [chartType, setChartType] = useState('area');
  const [loading, setLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const POPULAR_STOCKS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'AMD'];

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Debounced search
  useEffect(() => {
    if (ticker.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/search/${ticker}`);
        setSearchResults(response.data.data?.slice(0, 5) || []);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ticker]);

  const fetchStock = async (symbol) => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    setTicker(symbol);
    setSearchResults([]);

    try {
      const [stockResponse, candlesResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/stock/${symbol}`),
        axios.get(`http://localhost:5000/api/candles/${symbol}?outputsize=${timeRange}`)
      ]);

      setStockData(stockResponse.data);

      // Process candle data for advanced charts
      const candles = candlesResponse.data.values?.reverse().map(item => ({
        date: new Date(item.datetime).toLocaleDateString(),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume) || 0
      })) || [];
      setCandleData(candles);

      // Fetch fundamentals (optional, may not always be available)
      try {
        const fundResponse = await axios.get(`http://localhost:5000/api/fundamentals/${symbol}`);
        setFundamentals(fundResponse.data);
      } catch {
        setFundamentals(null);
      }

    } catch (err) {
      setError("Stock not found. Try 'AAPL' or 'TSLA'");
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

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const CustomCandlestick = ({ x, y, width, height, open, close, high, low }) => {
    const isGreen = close > open;
    const color = isGreen ? '#10b981' : '#ef4444';
    const bodyHeight = Math.abs(close - open) * height / (high - low);
    const bodyY = isGreen ? y + (high - close) * height / (high - low) : y + (high - open) * height / (high - low);

    return (
      <g>
        {/* Wick */}
        <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth="1" />
        {/* Body */}
        <rect x={x} y={bodyY} width={width} height={bodyHeight || 1} fill={color} />
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-mesh noise-overlay text-white font-sans">
      {/* Floating gradient orbs for visual interest */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-float delay-300" />
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-pink-500/15 rounded-full blur-3xl animate-float delay-500" />
      </div>

      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        {/* Header */}
        <div className="max-w-7xl mx-auto">
          <header className="mb-12 animate-fade-in">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center animate-gradient">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 blur opacity-40 animate-gradient" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">
                  ZENITH
                </h1>
                <p className="text-gray-400 text-sm md:text-base tracking-wide">
                  Real-Time Financial Terminal
                </p>
              </div>
            </div>
          </header>

          {/* Search Section */}
          <div className="relative mb-10 animate-fade-in delay-100">
            <div className="flex gap-3 md:gap-4">
              <div className="flex-1 relative group">
                <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 blur transition-all duration-500 ${searchFocused ? 'opacity-70' : 'group-hover:opacity-50'}`} />
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search stocks (e.g., AAPL, TSLA, GOOGL)" 
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    className="w-full py-4 pl-12 pr-4 rounded-2xl bg-gray-900/80 text-white font-medium text-lg outline-none transition-all duration-300 border border-gray-700/50 focus:border-purple-500/50 backdrop-blur-xl placeholder:text-gray-500"
                    onKeyDown={(e) => e.key === 'Enter' && fetchStock(ticker)}
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-3 w-full search-dropdown rounded-2xl overflow-hidden z-50 animate-fade-in-scale">
                    {searchResults.map((result, idx) => (
                      <div 
                        key={idx}
                        onClick={() => fetchStock(result.symbol)}
                        className="p-4 hover:bg-gray-700/50 cursor-pointer border-b border-gray-700/50 last:border-0 transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{result.symbol}</span>
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">Stock</span>
                          </div>
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="text-sm text-gray-400 mt-1 truncate">{result.instrument_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => fetchStock(ticker)}
                disabled={loading}
                className="btn-primary px-6 md:px-10 py-4 rounded-2xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden md:inline">Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Search</span>
                    <svg className="w-5 h-5 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Popular Stocks */}
            <div className="flex gap-2 mt-5 flex-wrap items-center">
              <span className="text-gray-500 text-sm font-medium mr-1">Trending:</span>
              {POPULAR_STOCKS.map((stock, idx) => (
                <button
                  key={stock}
                  onClick={() => fetchStock(stock)}
                  className="tag-pill px-4 py-1.5 rounded-full text-sm font-medium text-blue-300 hover:text-white"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {stock}
                </button>
              ))}
            </div>
          </div>

          {/* Watchlist Section */}
          {watchlist.length > 0 && (
            <div className="mb-10 glass-strong p-6 rounded-2xl animate-fade-in">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-3 text-gray-200">
                <span className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </span>
                Your Watchlist
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">{watchlist.length} items</span>
              </h2>
              <div className="flex gap-3 flex-wrap">
                {watchlist.map((symbol, idx) => (
                  <div 
                    key={symbol} 
                    className="watchlist-item flex items-center gap-3 px-4 py-2.5 animate-slide-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <button 
                      onClick={() => fetchStock(symbol)}
                      className="font-mono font-semibold hover:text-blue-400 transition-colors text-white"
                    >
                      {symbol}
                    </button>
                    <button 
                      onClick={() => removeFromWatchlist(symbol)}
                      className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* Stock Data Display */}
          {stockData && (
            <div className="glass-strong p-6 md:p-8 rounded-3xl stock-card animate-fade-in border border-gray-700/50">
              
              {/* Header with Stock Info */}
              <div className="flex justify-between items-start mb-8 flex-wrap gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-gray-700/50">
                    <span className="text-2xl font-bold text-gradient">{stockData.symbol?.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{stockData.symbol}</h2>
                      {!watchlist.includes(stockData.symbol) && (
                        <button 
                          onClick={() => addToWatchlist(stockData.symbol)}
                          className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center hover:bg-yellow-500/20 transition-all group"
                          title="Add to watchlist"
                        >
                          <svg className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      {watchlist.includes(stockData.symbol) && (
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {timeRange} Day{timeRange > 1 ? 's' : ''} Performance
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-4xl md:text-5xl font-mono font-bold price-ticker count-up tracking-tight">
                    ${stockData.price.toFixed(2)}
                  </p>
                  <div className={`inline-flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full text-lg font-semibold ${stockData.percentChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {stockData.percentChange >= 0 ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {stockData.percentChange > 0 ? '+' : ''}{stockData.percentChange.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Chart Controls */}
              <div className="flex gap-4 mb-6 flex-wrap">
              {/* Time Range Selector */}
              <div className="flex gap-2 p-1.5 bg-gray-800/50 rounded-xl border border-gray-700/50">
                {[
                  { label: '1W', value: '7' },
                  { label: '1M', value: '30' },
                  { label: '3M', value: '90' },
                  { label: '6M', value: '180' },
                  { label: '1Y', value: '365' }
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setTimeRange(range.value);
                      fetchStock(stockData.symbol);
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      timeRange === range.value 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex gap-2 p-1.5 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                    chartType === 'area' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
                  </svg>
                  Area
                </button>
                <button
                  onClick={() => setChartType('candlestick')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                    chartType === 'candlestick' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Candlestick
                </button>
              </div>
            </div>

            {/* Chart Display */}
            {chartType === 'area' && stockData.history && (
              <div className="h-[400px] w-full mb-8 chart-container animate-fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stockData.history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                        <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6"/>
                        <stop offset="50%" stopColor="#8b5cf6"/>
                        <stop offset="100%" stopColor="#ec4899"/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280" 
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#6b7280"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      axisLine={{ stroke: '#374151' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                        borderColor: 'rgba(75, 85, 99, 0.5)', 
                        borderRadius: '12px',
                        color: '#fff',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                      }} 
                      itemStyle={{ color: '#a78bfa' }}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                      formatter={(value) => [`$${value.toFixed(2)}`, 'Price']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="url(#strokeGradient)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === 'candlestick' && candleData && (
              <div className="h-[500px] w-full mb-8 chart-container animate-fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candleData}>
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4b5563" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#374151" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="price" 
                      domain={['auto', 'auto']} 
                      stroke="#6b7280"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis 
                      yAxisId="volume" 
                      orientation="right" 
                      stroke="#6b7280"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                        borderColor: 'rgba(75, 85, 99, 0.5)',
                        borderRadius: '12px',
                        color: '#fff',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                      }}
                      formatter={(value, name) => {
                        if (name === 'volume') return [formatNumber(value), 'Volume'];
                        return [`$${parseFloat(value).toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)];
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-gray-400">{value}</span>}
                    />
                    <Bar yAxisId="volume" dataKey="volume" fill="url(#volumeGradient)" radius={[4, 4, 0, 0]} />
                    <Line 
                      yAxisId="price" 
                      type="monotone" 
                      dataKey="close" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#1f2937', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fundamentals Section */}
            {fundamentals && (
              <div className="mt-8 pt-8 border-t border-gray-700/50">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2 text-gray-300">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Key Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {fundamentals.statistics?.valuations_metrics?.market_capitalization && (
                    <div className="stat-card">
                      <p className="text-gray-400 text-sm mb-1">Market Cap</p>
                      <p className="text-xl font-bold font-mono-numbers">{fundamentals.statistics.valuations_metrics.market_capitalization}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.valuations_metrics?.pe_ratio && (
                    <div className="stat-card">
                      <p className="text-gray-400 text-sm mb-1">P/E Ratio</p>
                      <p className="text-xl font-bold font-mono-numbers">{fundamentals.statistics.valuations_metrics.pe_ratio}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.stock_price_summary?.fifty_two_week_high && (
                    <div className="stat-card">
                      <p className="text-gray-400 text-sm mb-1">52W High</p>
                      <p className="text-xl font-bold font-mono-numbers text-emerald-400">${fundamentals.statistics.stock_price_summary.fifty_two_week_high}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.stock_price_summary?.fifty_two_week_low && (
                    <div className="stat-card">
                      <p className="text-gray-400 text-sm mb-1">52W Low</p>
                      <p className="text-xl font-bold font-mono-numbers text-red-400">${fundamentals.statistics.stock_price_summary.fifty_two_week_low}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!stockData && !loading && !error && (
          <div className="text-center py-20 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-gray-700/50 mb-6">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-400 mb-2">Start Exploring</h3>
            <p className="text-gray-500 max-w-md mx-auto">Search for a stock symbol above or click on one of the trending stocks to view real-time data and charts.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-800/50 text-center">
          <p className="text-gray-600 text-sm">
            Built with ❤️ • Data provided by Twelve Data API
          </p>
        </footer>
      </div>
      </div>
    </div>
  );
}

export default App;