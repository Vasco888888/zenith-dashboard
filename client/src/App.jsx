import { useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function App() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState(null);
  const [error, setError] = useState(null);

  const fetchStock = async () => {
    if (!ticker) return;
    setError(null);
    try {
      // Calls YOUR Node server
      const response = await axios.get(`http://localhost:5000/api/stock/${ticker}`);
      setStockData(response.data);
    } catch (err) {
      setError("Stock not found. Try 'AAPL' or 'TSLA'");
      setStockData(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-10 font-sans">
      
      {/* --- SEARCH SECTION --- */}
      <h1 className="text-4xl font-bold mb-8 text-blue-400">Stock Market Search</h1>
      
      <div className="flex gap-4 mb-10">
        <input 
          type="text" 
          placeholder="Enter Symbol (e.g., AAPL)" 
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          className="p-3 rounded text-black font-bold text-xl outline-none"
          onKeyDown={(e) => e.key === 'Enter' && fetchStock()}
        />
        <button 
          onClick={fetchStock}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-bold transition"
        >
          Search
        </button>
      </div>

      {/* --- ERROR MESSAGE --- */}
      {error && <p className="text-red-400 text-xl mb-4">{error}</p>}

      {/* --- DATA DISPLAY --- */}
      {stockData && (
        <div className="w-full max-w-4xl bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
          
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-5xl font-bold">{stockData.symbol}</h2>
              <p className="text-gray-400 mt-1">Last 30 Days Performance</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-mono">${stockData.price}</p>
              <p className={`text-xl ${stockData.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stockData.percentChange > 0 ? '+' : ''}{stockData.percentChange}% Today
              </p>
            </div>
          </div>

          {/* --- CHART --- */}
          <div className="h-[400px] w-full">
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
        </div>
      )}
    </div>
  );
}

export default App;