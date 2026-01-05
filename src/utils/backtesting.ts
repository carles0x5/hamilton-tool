import { MarketData } from './types';
import { StrategySignal, getStrategyById } from './strategies';

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  type: 'LONG' | 'SHORT';
  returnPct: number;
  holdingPeriod: number;
}

export interface BacktestResult {
  // Strategy info
  strategyId: string;
  strategyName: string;
  
  // Performance metrics
  totalReturn: number;
  buyAndHoldReturn: number;
  excessReturn: number;
  annualizedReturn: number;
  annualizedBuyAndHold: number;
  
  // Risk metrics
  maxDrawdown: number;
  maxDrawdownBuyAndHold: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingPeriod: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  // Time series data for charting
  equityCurve: { date: string; strategy: number; buyAndHold: number; drawdown: number }[];
  trades: Trade[];
  signals: StrategySignal[];
  
  // Period info
  startDate: string;
  endDate: string;
  tradingDays: number;
}

export interface BacktestConfig {
  strategyId: string;
  strategyParams: Record<string, number>;
  initialCapital: number;
  allowShorts: boolean;
  transactionCost: number;
}

const DEFAULT_CONFIG: BacktestConfig = {
  strategyId: 'hamilton',
  strategyParams: {},
  initialCapital: 10000,
  allowShorts: false,
  transactionCost: 0.1,
};

export function runBacktest(
  data: MarketData[],
  config: Partial<BacktestConfig> = {}
): BacktestResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { strategyId, strategyParams, initialCapital, allowShorts, transactionCost } = cfg;
  
  if (data.length < 2) {
    return createEmptyResult(strategyId);
  }

  // Get strategy
  const strategy = getStrategyById(strategyId);
  if (!strategy) {
    return createEmptyResult(strategyId);
  }

  // Generate signals using the strategy
  const strategyResult = strategy.calculate(data, strategyParams);
  const signals = strategyResult.signals;

  // Initialize tracking variables
  // START WITH INITIAL LONG POSITION for fair comparison with Buy & Hold
  let capital = initialCapital * (1 - transactionCost / 100); // Apply initial entry cost
  let position: 'LONG' | 'SHORT' | 'FLAT' = 'LONG';
  let entryPrice = data[0].close;
  let entryDate = data[0].date;
  let entryIndex = 0;
  
  const trades: Trade[] = [];
  const equityCurve: { date: string; strategy: number; buyAndHold: number; drawdown: number }[] = [];
  
  // Buy and hold tracking
  const buyAndHoldShares = initialCapital / data[0].close;
  let peakEquity = initialCapital;
  
  // Process each day
  for (let i = 0; i < data.length; i++) {
    const currentData = data[i];
    const signal = signals[i];
    const price = currentData.close;
    
    // Handle position changes based on signal
    // Skip position entry logic on day 0 since we start invested
    if (position === 'FLAT') {
      if (signal === 'BUY') {
        position = 'LONG';
        entryPrice = price;
        entryDate = currentData.date;
        entryIndex = i;
        capital *= (1 - transactionCost / 100);
      } else if (allowShorts && signal === 'SELL') {
        position = 'SHORT';
        entryPrice = price;
        entryDate = currentData.date;
        entryIndex = i;
        capital *= (1 - transactionCost / 100);
      }
    } else if (position === 'LONG') {
      if (signal === 'SELL') {
        // Close long position
        const returnPct = ((price - entryPrice) / entryPrice) * 100;
        capital *= (1 + returnPct / 100);
        capital *= (1 - transactionCost / 100);
        
        trades.push({
          entryDate,
          entryPrice,
          exitDate: currentData.date,
          exitPrice: price,
          type: 'LONG',
          returnPct,
          holdingPeriod: i - entryIndex,
        });
        
        position = 'FLAT';
        
        // If allowing shorts, enter short
        if (allowShorts) {
          position = 'SHORT';
          entryPrice = price;
          entryDate = currentData.date;
          entryIndex = i;
          capital *= (1 - transactionCost / 100);
        }
      }
    } else if (position === 'SHORT') {
      if (signal === 'BUY') {
        // Close short position
        const returnPct = ((entryPrice - price) / entryPrice) * 100;
        capital *= (1 + returnPct / 100);
        capital *= (1 - transactionCost / 100);
        
        trades.push({
          entryDate,
          entryPrice,
          exitDate: currentData.date,
          exitPrice: price,
          type: 'SHORT',
          returnPct,
          holdingPeriod: i - entryIndex,
        });
        
        position = 'FLAT';
        
        // Enter long
        position = 'LONG';
        entryPrice = price;
        entryDate = currentData.date;
        entryIndex = i;
        capital *= (1 - transactionCost / 100);
      }
    }
    
    // Calculate current equity (including open position)
    let currentEquity = capital;
    if (position === 'LONG') {
      const unrealizedPct = ((price - entryPrice) / entryPrice) * 100;
      currentEquity = capital * (1 + unrealizedPct / 100);
    } else if (position === 'SHORT') {
      const unrealizedPct = ((entryPrice - price) / entryPrice) * 100;
      currentEquity = capital * (1 + unrealizedPct / 100);
    }
    
    // Track peak for drawdown
    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    
    // Buy and hold value
    const buyAndHoldValue = buyAndHoldShares * price;
    
    equityCurve.push({
      date: currentData.date,
      strategy: currentEquity,
      buyAndHold: buyAndHoldValue,
      drawdown,
    });
  }
  
  // Close any open position at end
  if (position !== 'FLAT') {
    const lastPrice = data[data.length - 1].close;
    const lastDate = data[data.length - 1].date;
    
    if (position === 'LONG') {
      const returnPct = ((lastPrice - entryPrice) / entryPrice) * 100;
      capital *= (1 + returnPct / 100);
      trades.push({
        entryDate,
        entryPrice,
        exitDate: lastDate,
        exitPrice: lastPrice,
        type: 'LONG',
        returnPct,
        holdingPeriod: data.length - 1 - entryIndex,
      });
    } else if (position === 'SHORT') {
      const returnPct = ((entryPrice - lastPrice) / entryPrice) * 100;
      capital *= (1 + returnPct / 100);
      trades.push({
        entryDate,
        entryPrice,
        exitDate: lastDate,
        exitPrice: lastPrice,
        type: 'SHORT',
        returnPct,
        holdingPeriod: data.length - 1 - entryIndex,
      });
    }
  }
  
  // Calculate final metrics
  const finalEquity = equityCurve[equityCurve.length - 1]?.strategy || capital;
  const buyAndHoldFinal = buyAndHoldShares * data[data.length - 1].close;
  
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const buyAndHoldReturn = ((buyAndHoldFinal - initialCapital) / initialCapital) * 100;
  
  // Annualized returns (assuming 252 trading days per year)
  const tradingDays = data.length;
  const years = tradingDays / 252;
  const annualizedReturn = years > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : 0;
  const annualizedBuyAndHold = years > 0 ? (Math.pow(buyAndHoldFinal / initialCapital, 1 / years) - 1) * 100 : 0;
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let maxDrawdownBuyAndHold = 0;
  let peakBH = initialCapital;
  
  for (const point of equityCurve) {
    maxDrawdown = Math.max(maxDrawdown, point.drawdown);
    peakBH = Math.max(peakBH, point.buyAndHold);
    const ddBH = ((peakBH - point.buyAndHold) / peakBH) * 100;
    maxDrawdownBuyAndHold = Math.max(maxDrawdownBuyAndHold, ddBH);
  }
  
  // Calculate volatility (annualized std dev of daily returns)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].strategy - equityCurve[i - 1].strategy) / equityCurve[i - 1].strategy;
    dailyReturns.push(ret);
  }
  
  const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0 ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  
  // Sharpe ratio (assuming 0% risk-free rate for simplicity)
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;
  
  // Sortino ratio (downside deviation)
  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0 
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length 
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252) * 100;
  const sortinoRatio = downsideDeviation > 0 ? annualizedReturn / downsideDeviation : 0;
  
  // Calmar ratio (return / max drawdown)
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  
  // Trade statistics
  const winningTrades = trades.filter(t => t.returnPct > 0);
  const losingTrades = trades.filter(t => t.returnPct <= 0);
  
  const totalWins = winningTrades.reduce((sum, t) => sum + t.returnPct, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.returnPct, 0));
  
  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  const avgHoldingPeriod = trades.length > 0 
    ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length 
    : 0;
    
  // Calculate consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;
  
  for (const trade of trades) {
    if (trade.returnPct > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
  }
  
  return {
    strategyId,
    strategyName: strategy.name,
    totalReturn,
    buyAndHoldReturn,
    excessReturn: totalReturn - buyAndHoldReturn,
    annualizedReturn,
    annualizedBuyAndHold,
    maxDrawdown,
    maxDrawdownBuyAndHold,
    volatility,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    avgWin,
    avgLoss,
    profitFactor,
    avgHoldingPeriod,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    equityCurve,
    trades,
    signals,
    startDate: data[0].date,
    endDate: data[data.length - 1].date,
    tradingDays,
  };
}

// Run backtest for multiple strategies for comparison
export function runMultipleBacktests(
  data: MarketData[],
  strategyIds: string[],
  baseConfig: Omit<BacktestConfig, 'strategyId' | 'strategyParams'> & { strategyParams?: Record<string, Record<string, number>> }
): BacktestResult[] {
  return strategyIds.map(strategyId => {
    const params = baseConfig.strategyParams?.[strategyId] || {};
    return runBacktest(data, {
      ...baseConfig,
      strategyId,
      strategyParams: params,
    });
  });
}

function createEmptyResult(strategyId: string): BacktestResult {
  const strategy = getStrategyById(strategyId);
  return {
    strategyId,
    strategyName: strategy?.name || 'Unknown',
    totalReturn: 0,
    buyAndHoldReturn: 0,
    excessReturn: 0,
    annualizedReturn: 0,
    annualizedBuyAndHold: 0,
    maxDrawdown: 0,
    maxDrawdownBuyAndHold: 0,
    volatility: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    avgHoldingPeriod: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    equityCurve: [],
    trades: [],
    signals: [],
    startDate: '',
    endDate: '',
    tradingDays: 0,
  };
}
