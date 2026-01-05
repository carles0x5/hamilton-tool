import { OHLCVData } from '../utils/types';

export interface AlphaVantageTimeSeries {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  };
}

export interface AlphaVantageCryptoSeries {
  [date: string]: {
    '1a. open (USD)': string;
    '2a. high (USD)': string;
    '3a. low (USD)': string;
    '4a. close (USD)': string;
    '5. volume': string;
  };
}

export interface AlphaVantageForexSeries {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
  };
}

export function transformStockData(
  timeSeries: AlphaVantageTimeSeries
): OHLCVData[] {
  return Object.entries(timeSeries)
    .map(([date, data]) => ({
      date,
      open: parseFloat(data['1. open']),
      high: parseFloat(data['2. high']),
      low: parseFloat(data['3. low']),
      close: parseFloat(data['4. close']),
      volume: parseFloat(data['5. volume']),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function transformCryptoData(
  timeSeries: AlphaVantageCryptoSeries
): OHLCVData[] {
  return Object.entries(timeSeries)
    .map(([date, data]) => ({
      date,
      open: parseFloat(data['1a. open (USD)']),
      high: parseFloat(data['2a. high (USD)']),
      low: parseFloat(data['3a. low (USD)']),
      close: parseFloat(data['4a. close (USD)']),
      volume: parseFloat(data['5. volume']),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function transformForexData(
  timeSeries: AlphaVantageForexSeries
): OHLCVData[] {
  return Object.entries(timeSeries)
    .map(([date, data]) => ({
      date,
      open: parseFloat(data['1. open']),
      high: parseFloat(data['2. high']),
      low: parseFloat(data['3. low']),
      close: parseFloat(data['4. close']),
      volume: 0, // Forex doesn't have volume
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

