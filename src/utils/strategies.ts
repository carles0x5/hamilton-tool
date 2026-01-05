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
  category: 'trend' | 'momentum' | 'hybrid';
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

// ============================================
// Helper functions for technical indicators
// ============================================

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

// Keltner Channel calculation
function calculateKeltnerChannel(data: MarketData[], emaPeriod: number, atrPeriod: number, multiplier: number): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = data.map(d => d.close);
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(data, atrPeriod);
  
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (isNaN(middle[i]) || isNaN(atr[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + multiplier * atr[i]);
      lower.push(middle[i] - multiplier * atr[i]);
    }
  }
  
  return { upper, middle, lower };
}

// Supertrend calculation
function calculateSupertrend(data: MarketData[], period: number, multiplier: number): { supertrend: number[]; direction: number[] } {
  const atr = calculateATR(data, period);
  const supertrend: number[] = [];
  const direction: number[] = []; // 1 = bullish, -1 = bearish
  
  for (let i = 0; i < data.length; i++) {
    if (i < period || isNaN(atr[i])) {
      supertrend.push(NaN);
      direction.push(0);
      continue;
    }
    
    const hl2 = (data[i].high + data[i].low) / 2;
    const basicUpperBand = hl2 + multiplier * atr[i];
    const basicLowerBand = hl2 - multiplier * atr[i];
    
    if (i === period) {
      // Initialize
      supertrend.push(data[i].close > basicUpperBand ? basicLowerBand : basicUpperBand);
      direction.push(data[i].close > basicUpperBand ? 1 : -1);
      continue;
    }
    
    const prevSupertrend = supertrend[i - 1];
    const prevDirection = direction[i - 1];
    
    let finalUpperBand = basicUpperBand;
    let finalLowerBand = basicLowerBand;
    
    // Adjust bands based on previous values
    if (prevDirection === 1) {
      finalLowerBand = Math.max(basicLowerBand, prevSupertrend);
    } else {
      finalUpperBand = Math.min(basicUpperBand, prevSupertrend);
    }
    
    // Determine direction
    let newDirection: number;
    let newSupertrend: number;
    
    if (prevDirection === 1) {
      if (data[i].close < finalLowerBand) {
        newDirection = -1;
        newSupertrend = finalUpperBand;
      } else {
        newDirection = 1;
        newSupertrend = finalLowerBand;
      }
    } else {
      if (data[i].close > finalUpperBand) {
        newDirection = 1;
        newSupertrend = finalLowerBand;
      } else {
        newDirection = -1;
        newSupertrend = finalUpperBand;
      }
    }
    
    supertrend.push(newSupertrend);
    direction.push(newDirection);
  }
  
  return { supertrend, direction };
}

// ============================================
// Strategy Definitions
// ============================================

export const strategies: Strategy[] = [
  // ============================================
  // KEPT STRATEGIES (Improved)
  // ============================================
  
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
  
  // 2. Moving Average Crossover (Faster response)
  {
    id: 'ma_crossover',
    name: 'Moving Average Crossover',
    description: 'Buy when fast EMA crosses above slow EMA, sell on cross below',
    category: 'trend',
    parameters: [
      { id: 'fastPeriod', name: 'Fast EMA Period', defaultValue: 10, min: 5, max: 30, step: 1 },
      { id: 'slowPeriod', name: 'Slow EMA Period', defaultValue: 30, min: 15, max: 100, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const fastPeriod = params.fastPeriod || 10;
      const slowPeriod = params.slowPeriod || 30;
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
  
  // 3. MACD Strategy
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
  
  // 4. ADX Trend Following
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
  
  // 5. Donchian Breakout (Turtle Trading)
  {
    id: 'donchian_breakout',
    name: 'Donchian Breakout',
    description: 'Classic Turtle system: Buy on N-day high breakout, sell on N-day low',
    category: 'trend',
    parameters: [
      { id: 'entryPeriod', name: 'Entry Lookback', defaultValue: 20, min: 10, max: 55, step: 5 },
      { id: 'exitPeriod', name: 'Exit Lookback', defaultValue: 10, min: 5, max: 30, step: 5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const entryPeriod = params.entryPeriod || 20;
      const exitPeriod = params.exitPeriod || 10;
      const signals: StrategySignal[] = [];
      const upperChannel: number[] = [];
      const lowerChannel: number[] = [];
      
      let inPosition = false;
      
      for (let i = 0; i < data.length; i++) {
        if (i < entryPeriod) {
          signals.push('HOLD');
          upperChannel.push(NaN);
          lowerChannel.push(NaN);
          continue;
        }
        
        // Entry channel (longer period)
        const entryHighs = data.slice(i - entryPeriod, i).map(d => d.high);
        const entryLows = data.slice(i - entryPeriod, i).map(d => d.low);
        const entryUpper = Math.max(...entryHighs);
        const entryLower = Math.min(...entryLows);
        
        // Exit channel (shorter period)
        const exitLows = data.slice(Math.max(0, i - exitPeriod), i).map(d => d.low);
        const exitLower = Math.min(...exitLows);
        
        upperChannel.push(entryUpper);
        lowerChannel.push(entryLower);
        
        // Breakout above entry channel = BUY
        if (data[i].close > entryUpper && !inPosition) {
          signals.push('BUY');
          inPosition = true;
        }
        // Break below exit channel = SELL (exit long)
        else if (data[i].close < exitLower && inPosition) {
          signals.push('SELL');
          inPosition = false;
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { upperChannel, lowerChannel } };
    },
  },
  
  // ============================================
  // NEW TREND-FOLLOWING STRATEGIES
  // ============================================
  
  // 6. Dual Momentum (Antonacci)
  {
    id: 'dual_momentum',
    name: 'Dual Momentum',
    description: 'Go long when absolute momentum positive AND relative to cash, else exit',
    category: 'trend',
    parameters: [
      { id: 'lookback', name: 'Lookback Period', defaultValue: 200, min: 60, max: 252, step: 20 },
      { id: 'cashReturn', name: 'Risk-Free Rate (%/yr)', defaultValue: 4, min: 0, max: 10, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const lookback = params.lookback || 200;
      const cashReturn = (params.cashReturn || 4) / 100; // Annual rate
      const dailyCashReturn = cashReturn / 252; // Daily equivalent
      
      const signals: StrategySignal[] = [];
      const momentum: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < lookback) {
          signals.push('HOLD');
          momentum.push(NaN);
          continue;
        }
        
        // Calculate momentum (return over lookback period)
        const currentReturn = (data[i].close - data[lookback > i ? 0 : i - lookback].close) / data[i - lookback].close;
        const cashEquivalent = dailyCashReturn * lookback;
        
        momentum.push(currentReturn * 100); // Store as percentage
        
        // Absolute momentum: is asset return positive?
        // Relative momentum: is asset return > cash?
        const absoluteMomentum = currentReturn > 0;
        const relativeMomentum = currentReturn > cashEquivalent;
        
        const prevReturn = i > lookback 
          ? (data[i - 1].close - data[i - 1 - lookback].close) / data[i - 1 - lookback].close 
          : 0;
        const prevAbsolute = prevReturn > 0;
        const prevRelative = prevReturn > cashEquivalent;
        
        // Enter when both momentums turn positive
        if (absoluteMomentum && relativeMomentum && !(prevAbsolute && prevRelative)) {
          signals.push('BUY');
        }
        // Exit when either momentum turns negative
        else if ((!absoluteMomentum || !relativeMomentum) && (prevAbsolute && prevRelative)) {
          signals.push('SELL');
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { momentum } };
    },
  },
  
  // 7. Time Series Momentum (TSMOM)
  {
    id: 'tsmom',
    name: 'Time Series Momentum',
    description: 'Go long when N-period return is positive, exit when negative',
    category: 'trend',
    parameters: [
      { id: 'lookback', name: 'Lookback Period', defaultValue: 200, min: 20, max: 252, step: 20 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const lookback = params.lookback || 200;
      const signals: StrategySignal[] = [];
      const returns: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < lookback) {
          signals.push('HOLD');
          returns.push(NaN);
          continue;
        }
        
        const currentReturn = (data[i].close - data[i - lookback].close) / data[i - lookback].close;
        returns.push(currentReturn * 100);
        
        const prevReturn = i > lookback 
          ? (data[i - 1].close - data[i - 1 - lookback].close) / data[i - 1 - lookback].close 
          : 0;
        
        // Simple rule: positive momentum = long, negative = exit
        if (currentReturn > 0 && prevReturn <= 0) {
          signals.push('BUY');
        } else if (currentReturn <= 0 && prevReturn > 0) {
          signals.push('SELL');
        } else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { returns } };
    },
  },
  
  // 8. Keltner Channel Breakout
  {
    id: 'keltner_breakout',
    name: 'Keltner Channel Breakout',
    description: 'Buy on breakout above upper Keltner band, sell below lower band',
    category: 'trend',
    parameters: [
      { id: 'emaPeriod', name: 'EMA Period', defaultValue: 20, min: 10, max: 50, step: 5 },
      { id: 'atrPeriod', name: 'ATR Period', defaultValue: 14, min: 7, max: 21, step: 1 },
      { id: 'multiplier', name: 'ATR Multiplier', defaultValue: 2, min: 1, max: 4, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const emaPeriod = params.emaPeriod || 20;
      const atrPeriod = params.atrPeriod || 14;
      const multiplier = params.multiplier || 2;
      
      const { upper, middle, lower } = calculateKeltnerChannel(data, emaPeriod, atrPeriod, multiplier);
      const signals: StrategySignal[] = [];
      
      let inPosition = false;
      
      for (let i = 0; i < data.length; i++) {
        if (isNaN(upper[i]) || isNaN(lower[i])) {
          signals.push('HOLD');
          continue;
        }
        
        // Breakout above upper band = BUY
        if (data[i].close > upper[i] && data[i - 1]?.close <= upper[i - 1] && !inPosition) {
          signals.push('BUY');
          inPosition = true;
        }
        // Break below middle = SELL (trend weakening)
        else if (data[i].close < middle[i] && inPosition) {
          signals.push('SELL');
          inPosition = false;
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { upper, middle, lower } };
    },
  },
  
  // 9. Supertrend Strategy
  {
    id: 'supertrend',
    name: 'Supertrend',
    description: 'ATR-based trend following with automatic support/resistance flipping',
    category: 'trend',
    parameters: [
      { id: 'period', name: 'ATR Period', defaultValue: 10, min: 5, max: 20, step: 1 },
      { id: 'multiplier', name: 'Multiplier', defaultValue: 3, min: 1, max: 5, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const period = params.period || 10;
      const multiplier = params.multiplier || 3;
      
      const { supertrend, direction } = calculateSupertrend(data, period, multiplier);
      const signals: StrategySignal[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < period + 1 || direction[i] === 0) {
          signals.push('HOLD');
          continue;
        }
        
        // Direction flip from bearish to bullish
        if (direction[i] === 1 && direction[i - 1] === -1) {
          signals.push('BUY');
        }
        // Direction flip from bullish to bearish
        else if (direction[i] === -1 && direction[i - 1] === 1) {
          signals.push('SELL');
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { supertrend, direction } };
    },
  },
  
  // 10. Volatility Breakout (Larry Williams)
  {
    id: 'volatility_breakout',
    name: 'Volatility Breakout',
    description: 'Enter when price moves N x ATR from open, capturing momentum days',
    category: 'momentum',
    parameters: [
      { id: 'atrPeriod', name: 'ATR Period', defaultValue: 14, min: 7, max: 21, step: 1 },
      { id: 'multiplier', name: 'Breakout Multiplier', defaultValue: 0.5, min: 0.2, max: 1.5, step: 0.1 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const atrPeriod = params.atrPeriod || 14;
      const multiplier = params.multiplier || 0.5;
      
      const atr = calculateATR(data, atrPeriod);
      const signals: StrategySignal[] = [];
      const breakoutLevels: number[] = [];
      
      let inPosition = false;
      let entryPrice = 0;
      
      for (let i = 0; i < data.length; i++) {
        if (i < atrPeriod || isNaN(atr[i - 1])) {
          signals.push('HOLD');
          breakoutLevels.push(NaN);
          continue;
        }
        
        // Calculate breakout level from yesterday's close
        const breakoutUp = data[i - 1].close + multiplier * atr[i - 1];
        const breakoutDown = data[i - 1].close - multiplier * atr[i - 1];
        breakoutLevels.push(breakoutUp);
        
        // Upside breakout
        if (data[i].high > breakoutUp && !inPosition) {
          signals.push('BUY');
          inPosition = true;
          entryPrice = breakoutUp;
        }
        // Exit on downside breakout or significant reversal
        else if (inPosition && data[i].low < breakoutDown) {
          signals.push('SELL');
          inPosition = false;
        }
        // Trailing exit: if price drops below entry - 2*ATR
        else if (inPosition && data[i].close < entryPrice - 2 * atr[i]) {
          signals.push('SELL');
          inPosition = false;
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { atr, breakoutLevels } };
    },
  },
  
  // 11. Momentum Breakout with Volume Confirmation
  {
    id: 'volume_breakout',
    name: 'Volume Breakout',
    description: 'Donchian breakout confirmed by above-average volume',
    category: 'trend',
    parameters: [
      { id: 'breakoutPeriod', name: 'Breakout Period', defaultValue: 20, min: 10, max: 55, step: 5 },
      { id: 'volumePeriod', name: 'Volume MA Period', defaultValue: 20, min: 10, max: 50, step: 5 },
      { id: 'volumeMultiplier', name: 'Volume Multiplier', defaultValue: 1.5, min: 1, max: 3, step: 0.25 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const breakoutPeriod = params.breakoutPeriod || 20;
      const volumePeriod = params.volumePeriod || 20;
      const volumeMultiplier = params.volumeMultiplier || 1.5;
      
      const volumes = data.map(d => d.volume);
      const volumeMA = calculateSMA(volumes, volumePeriod);
      
      const signals: StrategySignal[] = [];
      const upperChannel: number[] = [];
      const lowerChannel: number[] = [];
      
      let inPosition = false;
      
      for (let i = 0; i < data.length; i++) {
        if (i < Math.max(breakoutPeriod, volumePeriod)) {
          signals.push('HOLD');
          upperChannel.push(NaN);
          lowerChannel.push(NaN);
          continue;
        }
        
        const highs = data.slice(i - breakoutPeriod, i).map(d => d.high);
        const lows = data.slice(i - breakoutPeriod, i).map(d => d.low);
        const upper = Math.max(...highs);
        const lower = Math.min(...lows);
        
        upperChannel.push(upper);
        lowerChannel.push(lower);
        
        const highVolume = data[i].volume > volumeMA[i] * volumeMultiplier;
        
        // Breakout with volume confirmation
        if (data[i].close > upper && highVolume && !inPosition) {
          signals.push('BUY');
          inPosition = true;
        }
        // Exit on breakdown
        else if (data[i].close < lower && inPosition) {
          signals.push('SELL');
          inPosition = false;
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { upperChannel, lowerChannel, volumeMA } };
    },
  },
  
  // 12. Trend Strength Filter Strategy
  {
    id: 'trend_strength',
    name: 'Trend Strength Filter',
    description: 'Long only when ADX strong AND price above 200 EMA, with ATR trailing stop',
    category: 'trend',
    parameters: [
      { id: 'trendPeriod', name: 'Trend EMA', defaultValue: 200, min: 100, max: 300, step: 20 },
      { id: 'adxPeriod', name: 'ADX Period', defaultValue: 14, min: 7, max: 28, step: 1 },
      { id: 'adxThreshold', name: 'ADX Threshold', defaultValue: 20, min: 15, max: 35, step: 5 },
      { id: 'atrStopMultiplier', name: 'ATR Stop Multiplier', defaultValue: 2, min: 1, max: 4, step: 0.5 },
    ],
    calculate: (data: MarketData[], params: Record<string, number>): StrategyResult => {
      const trendPeriod = params.trendPeriod || 200;
      const adxPeriod = params.adxPeriod || 14;
      const adxThreshold = params.adxThreshold || 20;
      const atrStopMultiplier = params.atrStopMultiplier || 2;
      
      const closes = data.map(d => d.close);
      const trendEMA = calculateEMA(closes, trendPeriod);
      const { adx, plusDI, minusDI } = calculateADX(data, adxPeriod);
      const atr = calculateATR(data, adxPeriod);
      
      const signals: StrategySignal[] = [];
      
      let inPosition = false;
      let trailingStop = 0;
      
      for (let i = 0; i < data.length; i++) {
        if (i < trendPeriod || isNaN(trendEMA[i]) || isNaN(adx[i])) {
          signals.push('HOLD');
          continue;
        }
        
        const aboveTrend = data[i].close > trendEMA[i];
        const strongTrend = adx[i] > adxThreshold;
        const bullishDI = plusDI[i] > minusDI[i];
        
        // All conditions met: enter
        if (aboveTrend && strongTrend && bullishDI && !inPosition) {
          signals.push('BUY');
          inPosition = true;
          trailingStop = data[i].close - atrStopMultiplier * atr[i];
        }
        // Update trailing stop if in position
        else if (inPosition) {
          const newStop = data[i].close - atrStopMultiplier * atr[i];
          trailingStop = Math.max(trailingStop, newStop);
          
          // Exit if price falls below trailing stop or trend breaks
          if (data[i].close < trailingStop || !aboveTrend) {
            signals.push('SELL');
            inPosition = false;
          } else {
            signals.push('HOLD');
          }
        }
        else {
          signals.push('HOLD');
        }
      }
      
      return { signals, indicators: { trendEMA, adx, plusDI, minusDI } };
    },
  },
];

export function getStrategyById(id: string): Strategy | undefined {
  return strategies.find(s => s.id === id);
}

export function getStrategiesByCategory(category: Strategy['category']): Strategy[] {
  return strategies.filter(s => s.category === category);
}
