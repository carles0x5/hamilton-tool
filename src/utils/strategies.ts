import { MarketData } from './types';
import { createTradingSignal } from './diagramLogic';

export type StrategySignal = 'BUY' | 'SELL' | 'HOLD';

export interface StrategyResult {
  signals: StrategySignal[];
  indicators: Record<string, number[]>;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'mean-reversion' | 'hybrid';
  parameters: StrategyParameter[];
  calculate: (data: MarketData[], params: Record<string, number>) => StrategyResult;
}

export interface StrategyParameter {
  id: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

// Helper functions for technical indicators
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

function calculateRSI(data: MarketData[], period: number): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      result.push(50);
      continue;
    }
    
    const change = data[i].close - data[i - 1].close;
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
    
    if (i < period) {
      result.push(50);
      continue;
    }
    
    let avgGain: number, avgLoss: number;
    
    if (i === period) {
      avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    } else {
      avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    }
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function calculateMACD(data: MarketData[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { macd: number[]; signal: number[]; histogram: number[] } {
  const closes = data.map(d => d.close);
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  const macd = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signal = calculateEMA(macd.filter(v => !isNaN(v)), signalPeriod);
  
  // Pad signal to match length
  const paddedSignal: number[] = [];
  let signalIndex = 0;
  for (let i = 0; i < macd.length; i++) {
    if (isNaN(macd[i]) || signalIndex >= signal.length) {
      paddedSignal.push(NaN);
    } else {
      paddedSignal.push(signal[signalIndex]);
      signalIndex++;
    }
  }
  
  const histogram = macd.map((m, i) => m - paddedSignal[i]);
  
  return { macd, signal: paddedSignal, histogram };
}

function calculateBollingerBands(data: MarketData[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = data.map(d => d.close);
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  
  return { upper, middle, lower };
}

function calculateATR(data: MarketData[], period: number): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRanges.push(tr);
    }
    
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      result.push(trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period);
    } else {
      result.push((result[i - 1] * (period - 1) + trueRanges[i]) / period);
    }
  }
  return result;
}

function calculateADX(data: MarketData[], period: number): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      tr.push(data[i].high - data[i].low);
    } else {
      const upMove = data[i].high - data[i - 1].high;
      const downMove = data[i - 1].low - data[i].low;
      
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      
      tr.push(Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      ));
    }
  }
  
  const smoothedPlusDM = calculateEMA(plusDM, period);
  const smoothedMinusDM = calculateEMA(minusDM, period);
  const smoothedTR = calculateEMA(tr, period);
  
  const plusDI = smoothedPlusDM.map((v, i) => smoothedTR[i] > 0 ? (v / smoothedTR[i]) * 100 : 0);
  const minusDI = smoothedMinusDM.map((v, i) => smoothedTR[i] > 0 ? (v / smoothedTR[i]) * 100 : 0);
  
  const dx = plusDI.map((plus, i) => {
    const sum = plus + minusDI[i];
    return sum > 0 ? (Math.abs(plus - minusDI[i]) / sum) * 100 : 0;
  });
  
  const adx = calculateEMA(dx, period);
  
  return { adx, plusDI, minusDI };
}

// Strategy Definitions
export const strategies: Strategy[] = [
  // 1. Hamilton Diagram Strategy
  {
    id: 'hamilton',
    name: 'Hamilton Diagram',
    description: 'Uses demand/supply force analysis to identify market states and generate signals',
    category: 'hybrid',
    parameters: [
      { id: 'threshold', name: 'Threshold', defaultValue: 30, min: 10, max: 50, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const threshold = params.threshold || 30;
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const signal = createTradingSignal(data[i].demand, data[i].supply, threshold);
        
        if (signal.action === 'LONG' || signal.action === 'ACCUMULATE') {
          signals.push('BUY');
        } else if (signal.action === 'SHORT' || signal.action === 'EXIT_LONG' || signal.action === 'REDUCE') {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: {} };
    },
  },
  
  // 2. Moving Average Crossover (Golden/Death Cross)
  {
    id: 'ma_crossover',
    name: 'Moving Average Crossover',
    description: 'Buy when fast MA crosses above slow MA (golden cross), sell on death cross',
    category: 'trend',
    parameters: [
      { id: 'fastPeriod', name: 'Fast MA Period', defaultValue: 20, min: 5, max: 50, step: 5 },
      { id: 'slowPeriod', name: 'Slow MA Period', defaultValue: 50, min: 20, max: 200, step: 10 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const fastPeriod = params.fastPeriod || 20;
      const slowPeriod = params.slowPeriod || 50;
      const closes = data.map(d => d.close);
      
      const fastMA = calculateEMA(closes, fastPeriod);
      const slowMA = calculateEMA(closes, slowPeriod);
      
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < slowPeriod || isNaN(fastMA[i]) || isNaN(slowMA[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const prevFastAbove = fastMA[i - 1] > slowMA[i - 1];
        const currFastAbove = fastMA[i] > slowMA[i];
        
        if (!prevFastAbove && currFastAbove) {
          signals.push('BUY');
        } else if (prevFastAbove && !currFastAbove) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { 
        signals, 
        indicators: { 
          fastMA, 
          slowMA 
        } 
      };
    },
  },
  
  // 3. RSI Mean Reversion
  {
    id: 'rsi_reversion',
    name: 'RSI Mean Reversion',
    description: 'Buy when RSI is oversold (<30), sell when overbought (>70)',
    category: 'mean-reversion',
    parameters: [
      { id: 'period', name: 'RSI Period', defaultValue: 14, min: 5, max: 30, step: 1 },
      { id: 'oversold', name: 'Oversold Level', defaultValue: 30, min: 10, max: 40, step: 5 },
      { id: 'overbought', name: 'Overbought Level', defaultValue: 70, min: 60, max: 90, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const period = params.period || 14;
      const oversold = params.oversold || 30;
      const overbought = params.overbought || 70;
      
      const rsi = calculateRSI(data, period);
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < period) {
          signals.push('HOLD');
          continue;
        }
        
        if (rsi[i] < oversold && rsi[i - 1] >= oversold) {
          signals.push('BUY');
        } else if (rsi[i] > overbought && rsi[i - 1] <= overbought) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { rsi } };
    },
  },
  
  // 4. MACD Strategy
  {
    id: 'macd',
    name: 'MACD Crossover',
    description: 'Buy when MACD crosses above signal line, sell when it crosses below',
    category: 'momentum',
    parameters: [
      { id: 'fastPeriod', name: 'Fast EMA', defaultValue: 12, min: 5, max: 20, step: 1 },
      { id: 'slowPeriod', name: 'Slow EMA', defaultValue: 26, min: 15, max: 40, step: 1 },
      { id: 'signalPeriod', name: 'Signal Period', defaultValue: 9, min: 5, max: 15, step: 1 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const fastPeriod = params.fastPeriod || 12;
      const slowPeriod = params.slowPeriod || 26;
      const signalPeriod = params.signalPeriod || 9;
      
      const { macd, signal, histogram } = calculateMACD(data, fastPeriod, slowPeriod, signalPeriod);
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < slowPeriod + signalPeriod || isNaN(macd[i]) || isNaN(signal[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const prevAbove = macd[i - 1] > signal[i - 1];
        const currAbove = macd[i] > signal[i];
        
        if (!prevAbove && currAbove) {
          signals.push('BUY');
        } else if (prevAbove && !currAbove) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { macd, signal: signal, histogram } };
    },
  },
  
  // 5. Bollinger Bands Mean Reversion
  {
    id: 'bollinger',
    name: 'Bollinger Bands',
    description: 'Buy when price touches lower band, sell when it touches upper band',
    category: 'mean-reversion',
    parameters: [
      { id: 'period', name: 'Period', defaultValue: 20, min: 10, max: 50, step: 5 },
      { id: 'stdDev', name: 'Std Deviations', defaultValue: 2, min: 1, max: 3, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const period = params.period || 20;
      const stdDev = params.stdDev || 2;
      
      const { upper, middle, lower } = calculateBollingerBands(data, period, stdDev);
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < period || isNaN(upper[i]) || isNaN(lower[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const price = data[i].close;
        const prevPrice = data[i - 1].close;
        
        // Buy when price crosses below lower band and starts recovering
        if (prevPrice <= lower[i - 1] && price > lower[i]) {
          signals.push('BUY');
        }
        // Sell when price crosses above upper band and starts declining
        else if (prevPrice >= upper[i - 1] && price < upper[i]) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { upper, middle, lower } };
    },
  },
  
  // 6. Trend Following (ADX + DI)
  {
    id: 'adx_trend',
    name: 'ADX Trend Following',
    description: 'Trade in trend direction when ADX shows strong trend (>25)',
    category: 'trend',
    parameters: [
      { id: 'period', name: 'ADX Period', defaultValue: 14, min: 7, max: 28, step: 1 },
      { id: 'threshold', name: 'ADX Threshold', defaultValue: 25, min: 15, max: 40, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const period = params.period || 14;
      const threshold = params.threshold || 25;
      
      const { adx, plusDI, minusDI } = calculateADX(data, period);
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < period * 2 || isNaN(adx[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const strongTrend = adx[i] > threshold;
        const bullish = plusDI[i] > minusDI[i];
        const prevBullish = plusDI[i - 1] > minusDI[i - 1];
        
        if (strongTrend && bullish && !prevBullish) {
          signals.push('BUY');
        } else if (strongTrend && !bullish && prevBullish) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { adx, plusDI, minusDI } };
    },
  },
  
  // 7. Breakout Strategy (Donchian Channel)
  {
    id: 'breakout',
    name: 'Donchian Breakout',
    description: 'Buy on N-day high breakout, sell on N-day low breakdown',
    category: 'trend',
    parameters: [
      { id: 'period', name: 'Lookback Period', defaultValue: 20, min: 10, max: 55, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const period = params.period || 20;
      const signals: StrategySignal[] = [];
      const upperChannel: number[] = [];
      const lowerChannel: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < period) {
          signals.push('HOLD');
          upperChannel.push(NaN);
          lowerChannel.push(NaN);
          continue;
        }
        
        const highs = data.slice(i - period, i).map(d => d.high);
        const lows = data.slice(i - period, i).map(d => d.low);
        const upper = Math.max(...highs);
        const lower = Math.min(...lows);
        
        upperChannel.push(upper);
        lowerChannel.push(lower);
        
        if (data[i].close > upper && data[i - 1].close <= data.slice(i - period - 1, i - 1).reduce((max, d) => Math.max(max, d.high), 0)) {
          signals.push('BUY');
        } else if (data[i].close < lower && data[i - 1].close >= data.slice(i - period - 1, i - 1).reduce((min, d) => Math.min(min, d.low), Infinity)) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { upperChannel, lowerChannel } };
    },
  },
  
  // 8. Triple MA Strategy (Conservative)
  {
    id: 'triple_ma',
    name: 'Triple Moving Average',
    description: 'Buy when short > medium > long MA, sell when short < medium < long',
    category: 'trend',
    parameters: [
      { id: 'shortPeriod', name: 'Short MA', defaultValue: 10, min: 5, max: 20, step: 1 },
      { id: 'mediumPeriod', name: 'Medium MA', defaultValue: 20, min: 15, max: 50, step: 5 },
      { id: 'longPeriod', name: 'Long MA', defaultValue: 50, min: 30, max: 200, step: 10 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const shortPeriod = params.shortPeriod || 10;
      const mediumPeriod = params.mediumPeriod || 20;
      const longPeriod = params.longPeriod || 50;
      const closes = data.map(d => d.close);
      
      const shortMA = calculateEMA(closes, shortPeriod);
      const mediumMA = calculateEMA(closes, mediumPeriod);
      const longMA = calculateEMA(closes, longPeriod);
      
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < longPeriod || isNaN(longMA[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const bullish = shortMA[i] > mediumMA[i] && mediumMA[i] > longMA[i];
        const bearish = shortMA[i] < mediumMA[i] && mediumMA[i] < longMA[i];
        const prevBullish = shortMA[i - 1] > mediumMA[i - 1] && mediumMA[i - 1] > longMA[i - 1];
        const prevBearish = shortMA[i - 1] < mediumMA[i - 1] && mediumMA[i - 1] < longMA[i - 1];
        
        if (bullish && !prevBullish) {
          signals.push('BUY');
        } else if (bearish && !prevBearish) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { shortMA, mediumMA, longMA } };
    },
  },
  
  // 9. RSI + MACD Combo
  {
    id: 'rsi_macd_combo',
    name: 'RSI + MACD Combo',
    description: 'Buy when RSI oversold AND MACD bullish crossover, high conviction signals only',
    category: 'hybrid',
    parameters: [
      { id: 'rsiPeriod', name: 'RSI Period', defaultValue: 14, min: 7, max: 21, step: 1 },
      { id: 'rsiOversold', name: 'RSI Oversold', defaultValue: 40, min: 20, max: 45, step: 5 },
      { id: 'rsiOverbought', name: 'RSI Overbought', defaultValue: 60, min: 55, max: 80, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const rsiPeriod = params.rsiPeriod || 14;
      const rsiOversold = params.rsiOversold || 40;
      const rsiOverbought = params.rsiOverbought || 60;
      
      const rsi = calculateRSI(data, rsiPeriod);
      const { macd, signal: macdSignal } = calculateMACD(data, 12, 26, 9);
      
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < 35 || isNaN(rsi[i]) || isNaN(macd[i]) || isNaN(macdSignal[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const rsiLow = rsi[i] < rsiOversold;
        const rsiHigh = rsi[i] > rsiOverbought;
        const macdBullishCross = macd[i] > macdSignal[i] && macd[i - 1] <= macdSignal[i - 1];
        const macdBearishCross = macd[i] < macdSignal[i] && macd[i - 1] >= macdSignal[i - 1];
        const macdBullish = macd[i] > macdSignal[i];
        const macdBearish = macd[i] < macdSignal[i];
        
        // Buy: RSI recovering from oversold + MACD bullish
        if ((rsiLow || rsi[i - 1] < rsiOversold) && (macdBullishCross || macdBullish)) {
          signals.push('BUY');
        }
        // Sell: RSI in overbought + MACD bearish
        else if ((rsiHigh || rsi[i - 1] > rsiOverbought) && (macdBearishCross || macdBearish)) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { rsi, macd, macdSignal } };
    },
  },
  
  // 10. Mean Reversion with Volatility Filter
  {
    id: 'mean_reversion_vol',
    name: 'Mean Reversion + Vol Filter',
    description: 'Mean reversion trades only in low volatility environments',
    category: 'mean-reversion',
    parameters: [
      { id: 'maPeriod', name: 'MA Period', defaultValue: 20, min: 10, max: 50, step: 5 },
      { id: 'atrPeriod', name: 'ATR Period', defaultValue: 14, min: 7, max: 21, step: 1 },
      { id: 'deviations', name: 'Entry Deviations', defaultValue: 2, min: 1, max: 3, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const maPeriod = params.maPeriod || 20;
      const atrPeriod = params.atrPeriod || 14;
      const deviations = params.deviations || 2;
      
      const closes = data.map(d => d.close);
      const ma = calculateSMA(closes, maPeriod);
      const atr = calculateATR(data, atrPeriod);
      
      // Calculate average ATR for volatility comparison
      const avgAtr = calculateSMA(atr.filter(v => !isNaN(v)), 50);
      
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < 70 || isNaN(ma[i]) || isNaN(atr[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const price = data[i].close;
        const upperBand = ma[i] + deviations * atr[i];
        const lowerBand = ma[i] - deviations * atr[i];
        
        // Only trade in low volatility (current ATR < average)
        const lowVol = atr[i] < avgAtr[Math.min(avgAtr.length - 1, i - 20)] * 1.2;
        
        if (lowVol && price < lowerBand && data[i - 1].close >= ma[i - 1] - deviations * atr[i - 1]) {
          signals.push('BUY');
        } else if (lowVol && price > upperBand && data[i - 1].close <= ma[i - 1] + deviations * atr[i - 1]) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { ma, atr } };
    },
  },
];

export function getStrategyById(id: string): Strategy | undefined {
  return strategies.find(s => s.id === id);
}

export function getStrategiesByCategory(category: Strategy['category']): Strategy[] {
  return strategies.filter(s => s.category === category);
}

