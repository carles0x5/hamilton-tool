export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData extends OHLCVData {
  demand: number;
  supply: number;
}

export enum DiagramPosition {
  FREE_RISE = 'FREE_RISE',        // ↑↑
  WEAK_BULL = 'WEAK_BULL',        // ↑→
  BEAR_RALLY = 'BEAR_RALLY',      // ↑↓
  CONSOLIDATION = 'CONSOLIDATION', // →↑
  CHAOS = 'CHAOS',                // →→
  DISTRIBUTION = 'DISTRIBUTION',   // →↓
  BULL_TRAP = 'BULL_TRAP',        // ↓↑
  WEAK_BEAR = 'WEAK_BEAR',        // ↓→
  FREE_FALL = 'FREE_FALL'         // ↓↓
}

export interface TradingSignal {
  position: DiagramPosition;
  action: 'LONG' | 'SHORT' | 'WAIT' | 'HOLD_LONG' | 'HOLD_SHORT' | 'EXIT_LONG' | 'EXIT_SHORT' | 'ACCUMULATE' | 'REDUCE';
  demand: number;
  supply: number;
  quality: 'Healthy' | 'Speculative' | 'Warning';
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  category: 'stocks' | 'crypto' | 'forex' | 'indices';
}

export type Timeframe = 'daily' | 'weekly' | 'hourly';

export type CalculationMethod = 'A' | 'B' | 'C' | 'D';

export interface CachedData {
  data: OHLCVData[];
  timestamp: number;
  symbol: string;
  timeframe: Timeframe;
  method: CalculationMethod;
}

