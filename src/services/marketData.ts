import { OHLCVData, Timeframe, MarketSymbol } from '../utils/types';
import { fetchMarketDataYahoo } from './yahooFinance';

/**
 * Unified market data fetcher
 * Uses Yahoo Finance (free, no API key required)
 */
export async function fetchMarketData(
  symbol: string,
  category: MarketSymbol['category'],
  timeframe: Timeframe
): Promise<OHLCVData[]> {
  return await fetchMarketDataYahoo(symbol, category, timeframe);
}

