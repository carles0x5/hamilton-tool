# Hamilton Diagram Market Analyzer

A web application for analyzing market supply/demand forces using the Hamilton Diagram methodology.

## Features

- **Market Analysis**: Analyze Indices, US Stocks, Crypto, and Forex markets
- **Multiple Timeframes**: Daily, Weekly, and Hourly analysis
- **Four Calculation Methods**:
  - Method A: Volume-Based
  - Method B: Price-Volume Momentum
  - Method C: Momentum
  - Method D: Accumulation/Distribution (Wyckoff)
- **Hamilton Diagram Visualization**: Interactive 3x3 grid showing market positions
- **Trading Signals**: Get actionable trading signals (LONG, SHORT, WAIT, etc.)
- **Charts**: Price charts and Demand/Supply force charts
- **KPIs**: Bullish/Bearish/Neutral period analysis
- **Smart Caching**: IndexedDB caching to minimize API calls

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

**Note:** The app uses **Yahoo Finance** which is completely free, requires no API key, and has no rate limits!

## Usage

1. Select a market category (Indices, US Stocks, Crypto, or Forex)
2. Choose a symbol from the dropdown or enter a custom symbol
3. Select a timeframe (Daily, Weekly, or 1 Hour)
4. Choose a calculation method (A, B, C, or D)
5. Click "Go" to analyze

The application will:

- Check cache first (if data is fresh, use cached data)
- Fetch from API only if cache is missing or stale
- Calculate demand/supply forces using the selected method
- Display the Hamilton Diagram with current position
- Show trading signals and KPIs
- Display price and force charts

## Data Sources

The application uses **Yahoo Finance** (free, no API key, no rate limits).

## Cache Strategy

The application uses IndexedDB to cache market data locally:

- **Daily data**: Valid for 24 hours
- **Weekly data**: Valid for 7 days
- **Hourly data**: Valid for 1 hour

This minimizes API calls and provides fast data access.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Recharts
- IndexedDB (via idb library)
- Yahoo Finance API

## License

MIT
