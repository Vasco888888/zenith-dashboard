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

    try {
        // 1. Tentar buscar ao Redis (Cache)
        const cachedData = await client.get(symbol);

        if (cachedData) {
            console.log(`⚡ Serving ${symbol} from Redis Cache`);
            // O Redis guarda tudo como texto, temos de fazer JSON.parse
            return res.json(JSON.parse(cachedData));
        }

        // 2. Se não estiver em cache, buscar à API (Twelve Data)
        console.log(`🌐 Fetching ${symbol} from Twelve Data API...`);

        // Busca cotação atual
        const quoteResponse = await axios.get(`https://api.twelvedata.com/quote`, {
            params: { 
                symbol: symbol, 
                apikey: API_KEY 
            }
        });

        // Busca histórico (Time Series - últimos 30 dias)
        const historyResponse = await axios.get(`https://api.twelvedata.com/time_series`, {
            params: {
                symbol: symbol,
                interval: '1day',
                outputsize: 30,
                apikey: API_KEY
            }
        });

        // Montar o objeto
        const stockData = {
            symbol: symbol,
            price: parseFloat(quoteResponse.data.close),
            percentChange: parseFloat(quoteResponse.data.percent_change),
            history: historyResponse.data.values ? historyResponse.data.values.reverse().map(item => ({
                date: new Date(item.datetime).toLocaleDateString(),
                price: parseFloat(item.close)
            })) : []
        };

        // 3. Guardar no Redis com expiração (Ex: 30 segundos)
        await client.set(symbol, JSON.stringify(stockData), { EX: 30 });

        res.json(stockData);

    } catch (error) {
        console.error("Error:", error.message);
        console.error("Full Error:", error.response?.data || error.response?.status);
        res.status(500).json({ error: "Stock not found or API error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});