import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [timeRange, setTimeRange] = useState('1M'); // Time range codes: 1W, 1M, 3M, 6M, 1Y
  const [chartType, setChartType] = useState('area');
  const [loading, setLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

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
    // Don't search if not actively searching or ticker too short
    if (!isSearching || ticker.length < 2) {
      setSearchResults([]);
      return;
    }

    // Clear error when user starts searching
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/search/${ticker}`);
        const results = response.data.data || [];
        // Filter duplicates by symbol (keep only the first of each)
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
    const selectedRange = range || timeRange; // Use passed range or state value
    setLoading(true);
    setError(null);
    setIsSearching(false);
    setTicker(symbol);
    setSearchResults([]);

    try {
      // Send range as parameter to both endpoints
      const [stockResponse, candlesResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/stock/${symbol}?range=${selectedRange}`),
        axios.get(`http://localhost:5000/api/candles/${symbol}?range=${selectedRange}`)
      ]);

      // Verify if data is valid
      if (!stockResponse.data || !stockResponse.data.price || isNaN(stockResponse.data.price)) {
        throw new Error('Invalid stock data');
      }

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
      console.error('Fetch error:', err);
      
      // Get specific error from API response
      const errorCode = err.response?.data?.code;
      const errorMessage = err.response?.data?.message;
      
      if (errorCode === 'RATE_LIMIT') {
        setError("API Rate Limit: Free tier allows 8 requests/minute and 800 requests/day. Please wait a moment and try again.");
      } else if (errorCode === 'NON_US_STOCK') {
        setError("Exchange Not Supported: Free API only supports US stocks. For European stocks, try their US ADR (e.g., EDPFY for EDP).");
      } else if (errorCode === 'NOT_FOUND') {
        setError("Stock Not Found: The ticker symbol doesn't exist. Please check the spelling and try again.");
      } else {
        setError(errorMessage || "An error occurred while fetching stock data. Please try again.");
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

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  // Calculate price range for candlestick chart
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
    const { x, y, width, height, payload, background } = props;
    if (!payload || payload.open === undefined) return null;
    
    const { open, close, high, low } = payload;
    const isGreen = close >= open;
    const color = isGreen ? '#10b981' : '#ef4444';
    
    if (high === low) return null;
    
    const candleWidth = Math.max(width * 0.6, 4);
    const xCenter = x + width / 2;
    const xLeft = xCenter - candleWidth / 2;
    
    // Use background to get the full chart area
    const chartHeight = background?.height || 400;
    const chartY = background?.y || 0;
    
    // Calculate scale using the overall price range from candlePriceRange
    const priceMin = candlePriceRange.min;
    const priceMax = candlePriceRange.max;
    const priceRange = priceMax - priceMin || 1;
    
    // Scale: pixels per dollar (inverted because SVG y increases downward)
    const scale = chartHeight / priceRange;
    
    // Convert price to Y position (higher price = lower Y in SVG)
    const priceToY = (price) => chartY + (priceMax - price) * scale;
    
    const wickTop = priceToY(high);
    const wickBottom = priceToY(low);
    const bodyTop = priceToY(Math.max(open, close));
    const bodyBottom = priceToY(Math.min(open, close));
    const bodyHeightScaled = Math.max(bodyBottom - bodyTop, 1);

    return (
      <g>
        {/* Wick (high to low line) */}
        <line 
          x1={xCenter} 
          y1={wickTop} 
          x2={xCenter} 
          y2={wickBottom} 
          stroke={color} 
          strokeWidth={1.5} 
        />
        {/* Body (open to close rectangle) */}
        <rect 
          x={xLeft} 
          y={bodyTop} 
          width={candleWidth} 
          height={bodyHeightScaled} 
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        {/* Header */}
        <div className="max-w-7xl mx-auto">
          <header className="mb-12 animate-fade-in">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-500 flex items-center justify-center" style={{width: '48px', height: '48px'}}>
                  <svg style={{width: '28px', height: '28px'}} className="text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">
                  ZENITH
                </h1>
                <p className="text-neutral-500 text-sm md:text-base tracking-wide">
                  Real-Time Financial Dashboard
                </p>
              </div>
            </div>
          </header>

          {/* Search Section */}
          <div className="relative mb-10 animate-fade-in delay-100 z-50">
            <div className="flex gap-3 md:gap-4">
              <div className="flex-1 relative z-50">
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-neutral-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search stocks (e.g., AAPL, TSLA, GOOGL)" 
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value.toUpperCase());
                      setIsSearching(true);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    className="w-full py-4 pl-12 pr-4 rounded-2xl bg-gray-800 text-white font-medium text-lg outline-none transition-all duration-300 border border-gray-700 focus:border-amber-500/50 placeholder:text-gray-500"
                    onKeyDown={(e) => e.key === 'Enter' && fetchStock(ticker)}
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-3 w-full search-dropdown rounded-2xl overflow-hidden z-[100] animate-fade-in-scale">
                    {searchResults.map((result, idx) => (
                      <div 
                        key={idx}
                        onClick={() => fetchStock(result.symbol)}
                        className="p-4 hover:bg-gray-700/50 cursor-pointer border-b border-gray-700 last:border-0 transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors">{result.symbol}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{result.exchange || 'Stock'}</span>
                            {result.country && (
                              <span className="text-xs text-gray-500">{result.country}</span>
                            )}
                          </div>
                          <svg style={{width: '16px', height: '16px'}} className="text-neutral-600 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="text-sm text-neutral-500 mt-1 truncate">{result.instrument_name}</div>
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
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
              <span className="text-neutral-600 text-sm font-medium mr-1">Trending:</span>
              {POPULAR_STOCKS.map((stock, idx) => (
                <button
                  key={stock}
                  onClick={() => fetchStock(stock)}
                  className="tag-pill px-4 py-1.5 rounded-full text-sm font-medium text-amber-400 hover:text-amber-300"
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
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-3 text-neutral-200">
                <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </span>
                Your Watchlist
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{watchlist.length} items</span>
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
                      className="font-mono font-semibold hover:text-amber-400 transition-colors text-white"
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
            <div className="bg-gray-800 p-6 md:p-8 rounded-3xl stock-card animate-fade-in border border-gray-700">
              
              {/* Header with Stock Info */}
              <div className="flex justify-between items-start mb-8 flex-wrap gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300/20 to-yellow-500/20 flex items-center justify-center border border-amber-500/50">
                    <span className="text-2xl font-bold text-gradient">{stockData.symbol?.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{stockData.symbol}</h2>
                      {!watchlist.includes(stockData.symbol) && (
                        <button 
                          onClick={() => addToWatchlist(stockData.symbol)}
                          className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/50 flex items-center justify-center hover:bg-amber-500/20 transition-all group"
                          title="Add to watchlist"
                        >
                          <svg className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      {watchlist.includes(stockData.symbol) && (
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-neutral-500 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {timeRange === '1W' ? '1 Week' : timeRange === '1M' ? '1 Month' : timeRange === '3M' ? '3 Months' : timeRange === '6M' ? '6 Months' : '1 Year'} Performance
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-4xl md:text-5xl font-mono font-bold price-ticker count-up tracking-tight text-amber-400">
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
              <div className="flex gap-2 p-1.5 bg-gray-800 rounded-xl border border-gray-700">
                {[
                  { label: '1W', value: '1W' },
                  { label: '1M', value: '1M' },
                  { label: '3M', value: '3M' },
                  { label: '6M', value: '6M' },
                  { label: '1Y', value: '1Y' }
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setTimeRange(range.value);
                      fetchStock(stockData.symbol, range.value); // Pass range directly
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      timeRange === range.value 
                        ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-gray-900 shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex gap-2 p-1.5 bg-gray-800 rounded-xl border border-gray-700">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                    chartType === 'area' 
                      ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-gray-900 shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
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
                      ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-gray-900 shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
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
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="50%" stopColor="#d97706" stopOpacity={0.15}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fbbf24"/>
                        <stop offset="50%" stopColor="#f59e0b"/>
                        <stop offset="100%" stopColor="#d97706"/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#525252" 
                      tick={{ fill: '#737373', fontSize: 12 }}
                      axisLine={{ stroke: '#262626' }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#525252"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      axisLine={{ stroke: '#262626' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.95)', 
                        borderColor: 'rgba(251, 191, 36, 0.3)', 
                        borderRadius: '12px',
                        color: '#fff',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)'
                      }} 
                      itemStyle={{ color: '#fbbf24' }}
                      labelStyle={{ color: '#737373', marginBottom: '4px' }}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#525252"
                      tick={{ fill: '#737373', fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="price" 
                      domain={[candlePriceRange.min, candlePriceRange.max]} 
                      stroke="#525252"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.95)', 
                        borderColor: 'rgba(251, 191, 36, 0.3)',
                        borderRadius: '12px',
                        color: '#fff',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)'
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '12px', padding: '12px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)' }}>
                              <p style={{ color: '#a3a3a3', marginBottom: '8px' }}>Date: {label}</p>
                              <p style={{ color: '#fff' }}>Open: <span style={{ color: '#fbbf24' }}>${data.open?.toFixed(2)}</span></p>
                              <p style={{ color: '#fff' }}>High: <span style={{ color: '#10b981' }}>${data.high?.toFixed(2)}</span></p>
                              <p style={{ color: '#fff' }}>Low: <span style={{ color: '#ef4444' }}>${data.low?.toFixed(2)}</span></p>
                              <p style={{ color: '#fff' }}>Close: <span style={{ color: '#fbbf24' }}>${data.close?.toFixed(2)}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      payload={[
                        { value: 'Bullish', type: 'rect', color: '#10b981' },
                        { value: 'Bearish', type: 'rect', color: '#ef4444' }
                      ]}
                    />
                    <Bar 
                      yAxisId="price" 
                      dataKey="high" 
                      shape={<CustomCandlestick />}
                      isAnimationActive={false}
                      legendType="none"
                      background={{ fill: 'transparent' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fundamentals Section - only shows if data exists */}
            {fundamentals && (
              fundamentals.statistics?.valuations_metrics?.market_capitalization ||
              fundamentals.statistics?.valuations_metrics?.pe_ratio ||
              fundamentals.statistics?.stock_price_summary?.fifty_two_week_high ||
              fundamentals.statistics?.stock_price_summary?.fifty_two_week_low
            ) && (
              <div className="mt-8 pt-8 border-t border-gray-700">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2 text-neutral-300">
                  <svg style={{width: '20px', height: '20px'}} className="text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Key Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {fundamentals.statistics?.valuations_metrics?.market_capitalization && (
                    <div className="stat-card">
                      <p className="text-neutral-500 text-sm mb-1">Market Cap</p>
                      <p className="text-xl font-bold font-mono-numbers text-amber-400">${formatNumber(fundamentals.statistics.valuations_metrics.market_capitalization)}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.valuations_metrics?.pe_ratio && (
                    <div className="stat-card">
                      <p className="text-neutral-500 text-sm mb-1">P/E Ratio</p>
                      <p className="text-xl font-bold font-mono-numbers">{parseFloat(fundamentals.statistics.valuations_metrics.pe_ratio).toFixed(2)}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.stock_price_summary?.fifty_two_week_high && (
                    <div className="stat-card">
                      <p className="text-neutral-500 text-sm mb-1">52W High</p>
                      <p className="text-xl font-bold font-mono-numbers text-emerald-400">${fundamentals.statistics.stock_price_summary.fifty_two_week_high}</p>
                    </div>
                  )}
                  {fundamentals.statistics?.stock_price_summary?.fifty_two_week_low && (
                    <div className="stat-card">
                      <p className="text-neutral-500 text-sm mb-1">52W Low</p>
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
            <div className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300/10 to-yellow-500/10 border border-amber-500/50 mb-6" style={{width: '96px', height: '96px'}}>
              <svg style={{width: '48px', height: '48px'}} className="text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-neutral-400 mb-2">Start Exploring</h3>
            <p className="text-neutral-600 max-w-md mx-auto">Search for a stock symbol above or click on one of the trending stocks to view real-time data and charts.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-600 text-sm">
            Data provided by Twelve Data API
          </p>
        </footer>
        </div>
      </div>
    </div>
  );
}

export default App;