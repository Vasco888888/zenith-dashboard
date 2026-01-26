const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require('redis'); // Importar Redis
require('dotenv').config();

const app = express();
app.use(cors());

const PORT = 5000;
const API_KEY = process.env.TWELVE_DATA_KEY;

console.log("DEBUG: API_KEY loaded:", API_KEY ? "✅ YES" : "❌ NO");
console.log("DEBUG: API_KEY length:", API_KEY?.length || 0);

// --- HELPER: Calcular timestamps baseado no range ---
function getTimeRange(range) {
    const now = new Date();
    const to = Math.floor(now.getTime() / 1000); // UNIX timestamp atual
    let from;
    let outputsize;

    switch (range) {
        case '1W':
            from = Math.floor(new Date(now - 7 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 7;
            break;
        case '1M':
            from = Math.floor(new Date(now - 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 30;
            break;
        case '3M':
            from = Math.floor(new Date(now - 90 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 90;
            break;
        case '6M':
            from = Math.floor(new Date(now - 180 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 180;
            break;
        case '1Y':
            from = Math.floor(new Date(now - 365 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 365;
            break;
        default: // Default to 1M
            from = Math.floor(new Date(now - 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
            outputsize = 30;
    }

    return { from, to, outputsize };
}

// --- CONFIGURAÇÃO REDIS ---
const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true,
        rejectUnauthorized: false // This fixes most SSL connection issues
    }
});

client.on('error', (err) => console.log('Redis Client Error', err));

// Temos de conectar ao Redis antes de iniciar o servidor
(async () => {
    await client.connect();
    console.log("✅ Conectado ao Redis com sucesso!");
})();

app.get('/api/stock/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '1M'; // Default: 1 mês
    const { outputsize } = getTimeRange(range);

    try {
        // 1. Cache key agora inclui o range: AAPL_1M, AAPL_1Y, etc.
        const cacheKey = `${symbol}_${range}`;
        const cachedData = await client.get(cacheKey);

        if (cachedData) {
            console.log(`⚡ Serving ${symbol} (${range}) from Redis Cache`);
            return res.json(JSON.parse(cachedData));
        }

        // 2. Se não estiver em cache, buscar à API (Twelve Data)
        console.log(`🌐 Fetching ${symbol} (${range}) from Twelve Data API...`);

        // Busca cotação atual
        const quoteResponse = await axios.get(`https://api.twelvedata.com/quote`, {
            params: { 
                symbol: symbol, 
                apikey: API_KEY 
            }
        });

        // Busca histórico (Time Series - baseado no range)
        const historyResponse = await axios.get(`https://api.twelvedata.com/time_series`, {
            params: {
                symbol: symbol,
                interval: '1day',
                outputsize: outputsize,
                apikey: API_KEY
            }
        });

        // Montar o objeto
        const stockData = {
            symbol: symbol,
            price: parseFloat(quoteResponse.data.close),
            percentChange: parseFloat(quoteResponse.data.percent_change),
            range: range,
            history: historyResponse.data.values ? historyResponse.data.values.reverse().map(item => ({
                date: new Date(item.datetime).toLocaleDateString(),
                price: parseFloat(item.close)
            })) : []
        };

        // 3. Guardar no Redis com expiração (30 segundos para dados curtos, mais para longos)
        const cacheExpiry = range === '1W' ? 30 : range === '1Y' ? 300 : 60;
        await client.set(cacheKey, JSON.stringify(stockData), { EX: cacheExpiry });

        res.json(stockData);

    } catch (error) {
        console.error("Error:", error.message);
        console.error("Full Error:", error.response?.data || error.response?.status);
        res.status(500).json({ error: "Stock not found or API error" });
    }
});

// --- SYMBOL SEARCH ENDPOINT ---
app.get('/api/search/:query', async (req, res) => {
    const query = req.params.query;
    
    try {
        const cacheKey = `search:${query}`;
        const cached = await client.get(cacheKey);
        
        if (cached) {
            console.log(`⚡ Serving search results for "${query}" from cache`);
            return res.json(JSON.parse(cached));
        }

        const response = await axios.get(`https://api.twelvedata.com/symbol_search`, {
            params: { symbol: query, apikey: API_KEY }
        });

        await client.set(cacheKey, JSON.stringify(response.data), { EX: 3600 }); // Cache 1 hour
        res.json(response.data);
    } catch (error) {
        console.error("Search Error:", error.message);
        res.status(500).json({ error: "Search failed" });
    }
});

// --- FUNDAMENTALS ENDPOINT ---
app.get('/api/fundamentals/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    try {
        const cacheKey = `fundamentals:${symbol}`;
        const cached = await client.get(cacheKey);
        
        if (cached) {
            console.log(`⚡ Serving fundamentals for ${symbol} from cache`);
            return res.json(JSON.parse(cached));
        }

        const [statsResponse, profileResponse] = await Promise.all([
            axios.get(`https://api.twelvedata.com/statistics`, {
                params: { symbol, apikey: API_KEY }
            }),
            axios.get(`https://api.twelvedata.com/profile`, {
                params: { symbol, apikey: API_KEY }
            })
        ]);

        const fundamentals = {
            ...statsResponse.data,
            ...profileResponse.data
        };

        await client.set(cacheKey, JSON.stringify(fundamentals), { EX: 600 }); // Cache 10 min
        res.json(fundamentals);
    } catch (error) {
        console.error("Fundamentals Error:", error.message);
        res.status(500).json({ error: "Fundamentals not available" });
    }
});

// --- OHLC CANDLE DATA ENDPOINT ---
app.get('/api/candles/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '1M';
    const interval = req.query.interval || '1day';
    const { outputsize } = getTimeRange(range);
    
    try {
        // Cache key inclui symbol + range + interval
        const cacheKey = `candles:${symbol}:${range}:${interval}`;
        const cached = await client.get(cacheKey);
        
        if (cached) {
            console.log(`⚡ Serving candles for ${symbol} (${range}) from cache`);
            return res.json(JSON.parse(cached));
        }

        console.log(`🌐 Fetching candles for ${symbol} (${range}, ${outputsize} days)...`);

        const response = await axios.get(`https://api.twelvedata.com/time_series`, {
            params: {
                symbol,
                interval,
                outputsize,
                apikey: API_KEY
            }
        });

        // Cache expiry baseado no range
        const cacheExpiry = range === '1W' ? 30 : range === '1Y' ? 300 : 60;
        await client.set(cacheKey, JSON.stringify(response.data), { EX: cacheExpiry });
        
        res.json(response.data);
    } catch (error) {
        console.error("Candles Error:", error.message);
        res.status(500).json({ error: "Candle data not available" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});