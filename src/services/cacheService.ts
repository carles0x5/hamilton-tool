import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OHLCVData, Timeframe, CalculationMethod, CachedData } from '../utils/types';

interface HamiltonDB extends DBSchema {
  marketData: {
    key: string;
    value: CachedData;
  };
}

const DB_NAME = 'hamilton-market-analyzer';
const DB_VERSION = 1;
const STORE_NAME = 'marketData';

let dbPromise: Promise<IDBPDatabase<HamiltonDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HamiltonDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HamiltonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

function getCacheKey(symbol: string, timeframe: Timeframe, method: CalculationMethod): string {
  return `${symbol}_${timeframe}_${method}`;
}

function getFreshnessDuration(timeframe: Timeframe): number {
  // Return milliseconds
  switch (timeframe) {
    case 'hourly':
      return 60 * 60 * 1000; // 1 hour
    case 'daily':
      return 24 * 60 * 60 * 1000; // 24 hours
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export async function getCachedData(
  symbol: string,
  timeframe: Timeframe,
  method: CalculationMethod
): Promise<OHLCVData[] | null> {
  try {
    const db = await getDB();
    const key = getCacheKey(symbol, timeframe, method);
    const cached = await db.get(STORE_NAME, key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (isCacheValid(cached, timeframe)) {
      return cached.data;
    }

    // Cache is stale, remove it
    await db.delete(STORE_NAME, key);
    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

export async function setCachedData(
  symbol: string,
  timeframe: Timeframe,
  method: CalculationMethod,
  data: OHLCVData[]
): Promise<void> {
  try {
    const db = await getDB();
    const key = getCacheKey(symbol, timeframe, method);
    const cached: CachedData = {
      data,
      timestamp: Date.now(),
      symbol,
      timeframe,
      method,
    };
    await db.put(STORE_NAME, cached, key);
  } catch (error) {
    console.error('Error setting cached data:', error);
  }
}

export function isCacheValid(cached: CachedData, timeframe: Timeframe): boolean {
  const freshnessDuration = getFreshnessDuration(timeframe);
  const age = Date.now() - cached.timestamp;
  return age < freshnessDuration;
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export async function cleanupOldCache(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const allKeys = await store.getAllKeys();
    
    const now = Date.now();
    for (const key of allKeys) {
      const cached = await store.get(key);
      if (cached) {
        const freshnessDuration = getFreshnessDuration(cached.timeframe);
        if (now - cached.timestamp > freshnessDuration * 2) {
          // Remove entries older than 2x freshness duration
          await store.delete(key);
        }
      }
    }
    await tx.done;
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

