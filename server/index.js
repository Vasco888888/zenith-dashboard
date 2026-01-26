const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require('redis'); // Importar Redis
require('dotenv').config();

const app = express();
app.use(cors());

const PORT = 5000;
const API_KEY = process.env.FINNHUB_KEY;

// --- CONFIGURAÇÃO REDIS ---
const client = createClient({
    url: process.env.REDIS_URL
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

        // 2. Se não estiver em cache, buscar à API (Finnhub)
        console.log(`🌐 Fetching ${symbol} from Finnhub API...`);

        // Busca histórico (Candles)
        const historyResponse = await axios.get(`https://finnhub.io/api/v1/stock/candle`, {
            params: {
                symbol: symbol,
                resolution: 'D',
                from: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60),
                to: Math.floor(Date.now() / 1000),
                token: API_KEY
            }
        });

        // Busca cotação atual
        const quoteResponse = await axios.get(`https://finnhub.io/api/v1/quote`, {
            params: { symbol: symbol, token: API_KEY }
        });

        // Montar o objeto
        const stockData = {
            symbol: symbol,
            price: quoteResponse.data.c,
            percentChange: quoteResponse.data.dp,
            history: historyResponse.data.t ? historyResponse.data.t.map((timestamp, index) => ({
                date: new Date(timestamp * 1000).toLocaleDateString(),
                price: historyResponse.data.c[index]
            })) : []
        };

        // 3. Guardar no Redis com expiração (Ex: 60 segundos)
        // 'EX': 60 define que o Redis apaga isto automaticamente após 60s
        await client.set(symbol, JSON.stringify(stockData), { EX: 60 });

        res.json(stockData);

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Stock not found or API error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});