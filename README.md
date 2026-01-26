# ZENITH | Real-Time Financial Dashboard

![Project Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)

**Zenith** is a high-performance Single Page Application (SPA) designed to track and visualize real-time stock market data. 

Unlike simple dashboards, Zenith implements a **custom proxy architecture** with **Server-Side Redis Caching** to handle high-traffic data requests, mitigate third-party API rate limits (HTTP 429), and reduce latency.

![Zenith Dashboard Screenshot](./screenshot.png)
## Tech Stack

### Frontend
* **React.js (Vite)** - Component-based UI.
* **Recharts** - Complex data visualization and interactive charts.
* **Tailwind CSS** - Modern, responsive styling (Dark Mode optimized).
* **Axios** - HTTP client.

### Backend & Architecture
* **Node.js & Express** - REST API Proxy server.
* **Redis (Upstash)** - Distributed caching layer for performance optimization.
* **Twelve Data API** - External financial data provider (800 requests/day on free tier).

---

## Key Features

* **Real-Time Data Search:** Instant access to 10,000+ US Stock tickers (e.g., AAPL, TSLA, NVDA).
* **Intelligent Caching:** Implements Redis to cache API responses (60s TTL), preventing redundant external calls and solving API rate-limiting issues.
* **Secure Proxy:** All API keys are hidden server-side, preventing exposure in the browser.
* **Interactive Charts:** Dynamic Area Charts showing 30-day historical performance.
* **Error Handling:** Robust handling of invalid tickers and network issues.

---

## Getting Started

Follow these steps to run Zenith locally.

### 1. Clone the repository
```bash
git clone https://github.com/Vasco888888/zenith-dashboard.git
cd zenith-dashboard
```

### 2. Backend Setup
Navigate to the server folder and install dependencies.

```bash
cd server
npm install
```

Create a .env file in the server folder with your API keys:

```
TWELVE_DATA_KEY=your_twelve_data_api_key
REDIS_URL=redis://default:password@your-redis-instance.upstash.io:6379
```

Start the server:

```bash
node index.js
# Server runs on port 5000
```

### 3. Frontend Setup
Open a new terminal, navigate to the client folder, and install dependencies.

```bash
cd client
npm install
npm run dev
```

Open your browser at http://localhost:5173.