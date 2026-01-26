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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-10 font-sans">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          ZENITH
        </h1>
        <p className="text-gray-400 mb-8">Real-Time Financial Terminal</p>

        {/* Search Section */}
        <div className="relative mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Search stocks (e.g., AAPL, TSLA)" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full p-4 rounded-lg text-black font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && fetchStock(ticker)}
              />
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50">
                  {searchResults.map((result, idx) => (
                    <div 
                      key={idx}
                      onClick={() => fetchStock(result.symbol)}
                      className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0"
                    >
                      <div className="font-bold">{result.symbol}</div>
                      <div className="text-sm text-gray-400">{result.instrument_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => fetchStock(ticker)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-8 py-4 rounded-lg font-bold transition"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>

          {/* Popular Stocks */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className="text-gray-400 text-sm self-center">Popular:</span>
            {POPULAR_STOCKS.map(stock => (
              <button
                key={stock}
                onClick={() => fetchStock(stock)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
              >
                {stock}
              </button>
            ))}
          </div>
        </div>

        {/* Watchlist Section */}
        {watchlist.length > 0 && (
          <div className="mb-8 bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <span>📌</span> Watchlist
            </h2>
            <div className="flex gap-2 flex-wrap">
              {watchlist.map(symbol => (
                <div key={symbol} className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-lg">
                  <button 
                    onClick={() => fetchStock(symbol)}
                    className="font-mono hover:text-blue-400 transition"
                  >
                    {symbol}
                  </button>
                  <button 
                    onClick={() => removeFromWatchlist(symbol)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <p className="text-red-400 text-xl mb-4 text-center">{error}</p>}

        {/* Stock Data Display */}
        {stockData && (
          <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-2xl border border-gray-700">
            
            {/* Header with Stock Info */}
            <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-5xl font-bold">{stockData.symbol}</h2>
                  {!watchlist.includes(stockData.symbol) && (
                    <button 
                      onClick={() => addToWatchlist(stockData.symbol)}
                      className="text-2xl hover:scale-110 transition"
                      title="Add to watchlist"
                    >
                      ⭐
                    </button>
                  )}
                </div>
                <p className="text-gray-400">
                  {timeRange} Day{timeRange > 1 ? 's' : ''} Performance
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-4xl font-mono font-bold">${stockData.price.toFixed(2)}</p>
                <p className={`text-xl font-bold ${stockData.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stockData.percentChange > 0 ? '+' : ''}{stockData.percentChange.toFixed(2)}% Today
                </p>
              </div>
            </div>

            {/* Chart Controls */}
            <div className="flex gap-4 mb-6 flex-wrap">
              {/* Time Range Selector */}
              <div className="flex gap-2">
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
                    className={`px-4 py-2 rounded-lg font-bold transition ${
                      timeRange === range.value 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-4 py-2 rounded-lg transition ${
                    chartType === 'area' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Area
                </button>
                <button
                  onClick={() => setChartType('candlestick')}
                  className={`px-4 py-2 rounded-lg transition ${
                    chartType === 'candlestick' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Candlestick
                </button>
              </div>
            </div>

            {/* Chart Display */}
            {chartType === 'area' && stockData.history && (
              <div className="h-[400px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stockData.history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis domain={['auto', 'auto']} stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} 
                      itemStyle={{ color: '#60a5fa' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === 'candlestick' && candleData && (
              <div className="h-[500px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis yAxisId="price" domain={['auto', 'auto']} stroke="#9ca3af" />
                    <YAxis yAxisId="volume" orientation="right" stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} 
                    />
                    <Legend />
                    <Bar yAxisId="volume" dataKey="volume" fill="#374151" opacity={0.3} />
                    <Line yAxisId="price" type="monotone" dataKey="close" stroke="#3b82f6" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fundamentals Section */}
            {fundamentals && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
                {fundamentals.statistics?.valuations_metrics?.market_capitalization && (
                  <div>
                    <p className="text-gray-400 text-sm">Market Cap</p>
                    <p className="text-xl font-bold">{fundamentals.statistics.valuations_metrics.market_capitalization}</p>
                  </div>
                )}
                {fundamentals.statistics?.valuations_metrics?.pe_ratio && (
                  <div>
                    <p className="text-gray-400 text-sm">P/E Ratio</p>
                    <p className="text-xl font-bold">{fundamentals.statistics.valuations_metrics.pe_ratio}</p>
                  </div>
                )}
                {fundamentals.statistics?.stock_price_summary?.fifty_two_week_high && (
                  <div>
                    <p className="text-gray-400 text-sm">52W High</p>
                    <p className="text-xl font-bold">${fundamentals.statistics.stock_price_summary.fifty_two_week_high}</p>
                  </div>
                )}
                {fundamentals.statistics?.stock_price_summary?.fifty_two_week_low && (
                  <div>
                    <p className="text-gray-400 text-sm">52W Low</p>
                    <p className="text-xl font-bold">${fundamentals.statistics.stock_price_summary.fifty_two_week_low}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;