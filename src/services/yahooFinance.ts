import axios from 'axios';
import { OHLCVData, Timeframe, MarketSymbol } from '../utils/types';
import { getCachedData, setCachedData } from './cacheService';
import { format } from 'date-fns';

// Yahoo Finance is free, no API key needed, no rate limits!
// Using direct API calls that work in the browser

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        currency: string;
        exchangeName: string;
        regularMarketPrice: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose: (number | null)[];
        }>;
      };
    }>;
    error: any;
  };
}

async function fetchYahooData(
  symbol: string,
  interval: '1d' | '1wk' | '1h',
  range: string
): Promise<OHLCVData[]> {
  // URL encode the symbol to handle special characters like ^
  const encodedSymbol = encodeURIComponent(symbol);
  
  // Use proxy in development, direct URL in production
  // In production, you may need a backend proxy or CORS proxy service
  const isDevelopment = import.meta.env.DEV;
  const baseUrl = isDevelopment 
    ? '/api/yahoo-finance' 
    : 'https://query1.finance.yahoo.com';
  
  const url = `${baseUrl}/v8/finance/chart/${encodedSymbol}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        interval,
        range,
        includePrePost: false,
        events: 'div,splits',
      },
      headers: {
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout for initial request
    });

    const data = response.data as YahooFinanceResponse;

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error(`No data found for symbol ${symbol}`);
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const adjClose = result.indicators.adjclose?.[0];

    const transformed: OHLCVData[] = timestamps
      .map((timestamp, index) => {
        const date = new Date(timestamp * 1000);
        // Use adjusted close if available, otherwise use regular close
        const rawClose = adjClose?.adjclose?.[index] ?? quote.close[index];
        const rawOpen = quote.open[index];
        const rawHigh = quote.high[index];
        const rawLow = quote.low[index];
        const rawVolume = quote.volume[index];
        
        // Check for null/undefined/NaN values
        const closePrice = (rawClose !== null && rawClose !== undefined && !isNaN(rawClose)) ? rawClose : 0;
        const openPrice = (rawOpen !== null && rawOpen !== undefined && !isNaN(rawOpen)) ? rawOpen : 0;
        const highPrice = (rawHigh !== null && rawHigh !== undefined && !isNaN(rawHigh)) ? rawHigh : 0;
        const lowPrice = (rawLow !== null && rawLow !== undefined && !isNaN(rawLow)) ? rawLow : 0;
        const volume = (rawVolume !== null && rawVolume !== undefined && !isNaN(rawVolume)) ? rawVolume : 0;
        
        return {
          date: format(date, 'yyyy-MM-dd'),
          open: openPrice,
          high: highPrice,
          low: lowPrice,
          close: closePrice,
          volume: volume,
        };
      })
      // Filter out invalid data - must have valid OHLC prices (volume can be 0 for some assets)
      .filter((item) => item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    return transformed;
  } catch (error: any) {
    // Check if it's a 429 rate limit error, timeout, or network/CORS error
    const isRateLimit = error?.response?.status === 429;
    const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
    const isNetworkError = error instanceof Error && (error.message.includes('Network Error') || error.message.includes('CORS'));
    
    if (isRateLimit || isNetworkError || isTimeout) {
      console.warn(`Yahoo Finance request failed (${isRateLimit ? 'rate limited' : isTimeout ? 'timeout' : 'network/CORS'}), trying CORS proxy...`);
      
      // Add a delay before retrying with proxy to avoid hammering
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use a public CORS proxy as fallback
      const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${range}&includePrePost=false&events=div,splits`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      
      try {
        const proxyResponse = await axios.get(proxyUrl, {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 15000, // 15 second timeout for proxy
        });
        
        const data = proxyResponse.data as YahooFinanceResponse;
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
          throw new Error(`No data found for symbol ${symbol}`);
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const adjClose = result.indicators.adjclose?.[0];

        const transformed: OHLCVData[] = timestamps
          .map((timestamp, index) => {
            const date = new Date(timestamp * 1000);
            const rawClose = adjClose?.adjclose?.[index] ?? quote.close[index];
            const rawOpen = quote.open[index];
            const rawHigh = quote.high[index];
            const rawLow = quote.low[index];
            const rawVolume = quote.volume[index];
            
            const closePrice = (rawClose !== null && rawClose !== undefined && !isNaN(rawClose)) ? rawClose : 0;
            const openPrice = (rawOpen !== null && rawOpen !== undefined && !isNaN(rawOpen)) ? rawOpen : 0;
            const highPrice = (rawHigh !== null && rawHigh !== undefined && !isNaN(rawHigh)) ? rawHigh : 0;
            const lowPrice = (rawLow !== null && rawLow !== undefined && !isNaN(rawLow)) ? rawLow : 0;
            const volume = (rawVolume !== null && rawVolume !== undefined && !isNaN(rawVolume)) ? rawVolume : 0;
            
            return {
              date: format(date, 'yyyy-MM-dd'),
              open: openPrice,
              high: highPrice,
              low: lowPrice,
              close: closePrice,
              volume: volume,
            };
          })
          .filter((item) => item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date));

        return transformed;
      } catch (proxyError: any) {
        // Provide helpful error message with suggestions
        if (isRateLimit || proxyError?.response?.status === 429) {
          throw new Error(
            `Yahoo Finance is rate limiting requests for ${symbol}. ` +
            `This can happen when too many requests are made. ` +
            `Please try again in 5-10 minutes, or clear your browser cache and try a different symbol first. ` +
            `If you have cached data, it will be used automatically.`
          );
        }
        if (isTimeout || proxyError?.code === 'ECONNABORTED') {
          throw new Error(
            `Request timed out while fetching data for ${symbol}. ` +
            `This may be due to network issues or Yahoo Finance being slow to respond. ` +
            `Please try again in a moment, or check your internet connection.`
          );
        }
        throw new Error(
          `Failed to fetch data for ${symbol}. ` +
          `Original error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Proxy also failed: ${proxyError instanceof Error ? proxyError.message : 'Unknown error'}. ` +
          `Please try again later or check if the symbol is correct.`
        );
      }
    }
    // Re-throw other errors as-is
    throw error;
  }
}

export async function fetchStockDataYahoo(
  symbol: string,
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  // Check cache first
  const cached = await getCachedData(symbol, timeframe, 'A');
  if (cached) {
    return cached;
  }

  try {
    let interval: '1d' | '1wk' | '1h' = '1d';
    let range = '5y'; // Default range - 5 years

    switch (timeframe) {
      case 'daily':
        interval = '1d';
        range = '5y'; // 5 years of daily data (~1250 trading days)
        break;
      case 'weekly':
        interval = '1wk';
        range = '10y'; // 10 years of weekly data (~520 weeks)
        break;
      case 'hourly':
        interval = '1h';
        range = '2mo'; // 2 months of hourly data (Yahoo limit for hourly)
        break;
    }

    const transformed = await fetchYahooData(symbol, interval, range);

    // Cache the data
    await setCachedData(symbol, timeframe, 'A', transformed);

    return transformed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Yahoo Finance error for ${symbol}: ${errorMessage}`);
  }
}

export async function fetchCryptoDataYahoo(
  symbol: string,
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  // Check cache first
  const cached = await getCachedData(symbol, timeframe, 'A');
  if (cached) {
    return cached;
  }

  try {
    // Yahoo Finance uses format like BTC-USD for crypto
    let yahooSymbol = symbol;
    if (symbol.includes('USD') && !symbol.includes('-')) {
      // Convert BTCUSD to BTC-USD
      yahooSymbol = symbol.replace('USD', '-USD');
    }

    let interval: '1d' | '1wk' | '1h' = '1d';
    let range = '5y';

    switch (timeframe) {
      case 'daily':
        interval = '1d';
        range = '5y'; // 5 years of daily data
        break;
      case 'weekly':
        interval = '1wk';
        range = '10y'; // 10 years of weekly data
        break;
      case 'hourly':
        interval = '1h';
        range = '2mo'; // 2 months of hourly data
        break;
    }

    const transformed = await fetchYahooData(yahooSymbol, interval, range);

    // Cache the data
    await setCachedData(symbol, timeframe, 'A', transformed);

    return transformed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Yahoo Finance crypto error for ${symbol}: ${errorMessage}`);
  }
}

export async function fetchForexDataYahoo(
  symbol: string,
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  // Check cache first
  const cached = await getCachedData(symbol, timeframe, 'A');
  if (cached) {
    return cached;
  }

  try {
    // Yahoo Finance uses format like EURUSD=X for forex
    let yahooSymbol = symbol;
    if (!symbol.endsWith('=X')) {
      yahooSymbol = `${symbol}=X`;
    }

    let interval: '1d' | '1wk' | '1h' = '1d';
    let range = '5y';

    switch (timeframe) {
      case 'daily':
        interval = '1d';
        range = '5y'; // 5 years of daily data
        break;
      case 'weekly':
        interval = '1wk';
        range = '10y'; // 10 years of weekly data
        break;
      case 'hourly':
        interval = '1h';
        range = '2mo'; // 2 months of hourly data
        break;
    }

    const transformed = await fetchYahooData(yahooSymbol, interval, range);

    // Cache the data
    await setCachedData(symbol, timeframe, 'A', transformed);

    return transformed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Yahoo Finance forex error for ${symbol}: ${errorMessage}`);
  }
}

export async function fetchIndexDataYahoo(
  symbol: string,
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  // Check cache first
  const cached = await getCachedData(symbol, timeframe, 'A');
  if (cached) {
    return cached;
  }

  try {
    // Indices use ^ prefix in Yahoo Finance (e.g., ^GSPC for S&P 500)
    // Ensure the symbol has the ^ prefix
    let yahooSymbol = symbol;
    if (!symbol.startsWith('^')) {
      yahooSymbol = `^${symbol}`;
    }

    let interval: '1d' | '1wk' | '1h' = '1d';
    let range = '5y';

    switch (timeframe) {
      case 'daily':
        interval = '1d';
        range = '5y'; // 5 years of daily data
        break;
      case 'weekly':
        interval = '1wk';
        range = '10y'; // 10 years of weekly data
        break;
      case 'hourly':
        interval = '1h';
        range = '2mo'; // 2 months of hourly data
        break;
    }

    const transformed = await fetchYahooData(yahooSymbol, interval, range);

    // Cache the data
    await setCachedData(symbol, timeframe, 'A', transformed);

    return transformed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Yahoo Finance index error for ${symbol}: ${errorMessage}`);
  }
}

export async function fetchMarketDataYahoo(
  symbol: string,
  category: MarketSymbol['category'],
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  switch (category) {
    case 'stocks':
      return fetchStockDataYahoo(symbol, timeframe);
    case 'indices':
      return fetchIndexDataYahoo(symbol, timeframe);
    case 'crypto':
      return fetchCryptoDataYahoo(symbol, timeframe);
    case 'forex':
      return fetchForexDataYahoo(symbol, timeframe);
    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}
