import { MarketData } from './types';
import { runBacktest, BacktestResult } from './backtesting';
import { strategies, Strategy } from './strategies';

export interface OptimizationConfig {
  strategyId: string;
  numWindows: number;           // Number of walk-forward windows (3-10)
  trainRatio: number;           // Training set ratio (0.6-0.8)
  optimizationMetric: OptimizationMetric;
  initialCapital: number;
  allowShorts: boolean;
  transactionCost: number;
  parameterRanges?: Record<string, { min: number; max: number; step: number }>;
}

export type OptimizationMetric = 'sharpe' | 'sortino' | 'calmar' | 'totalReturn' | 'profitFactor';

export interface WindowResult {
  windowIndex: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainPeriods: number;
  testPeriods: number;
  bestParams: Record<string, number>;
  trainMetric: number;
  testMetric: number;
  testReturn: number;
  testSharpe: number;
  testMaxDrawdown: number;
  testTrades: number;
  // Buy & Hold comparison
  buyHoldReturn: number;
  beatsBuyHold: boolean;
}

export interface OptimizationResult {
  strategyId: string;
  strategyName: string;
  metric: OptimizationMetric;
  
  // Aggregated out-of-sample results
  avgTestReturn: number;
  avgTestSharpe: number;
  avgTestDrawdown: number;
  totalTestTrades: number;
  
  // Overfitting indicators
  avgTrainMetric: number;
  avgTestMetric: number;
  overfitRatio: number;  // train/test metric ratio (>2 suggests overfitting)
  
  // Best parameters (most frequently selected across windows)
  recommendedParams: Record<string, number>;
  
  // Per-window results
  windowResults: WindowResult[];
  
  // Combined out-of-sample equity curve
  combinedEquityCurve: { date: string; equity: number; window: number }[];
  
  // Statistical significance
  isStatisticallySignificant: boolean;
  consistencyScore: number;  // % of windows with positive test return
  
  // Buy & Hold comparison
  avgBuyHoldReturn: number;  // Average B&H return across test windows
  totalBuyHoldReturn: number;  // Cumulative B&H return across all test windows
  totalStrategyReturn: number;  // Cumulative strategy return across all test windows
  winRateVsBuyHold: number;  // % of windows where strategy beats B&H
  excessReturn: number;  // Strategy total return - B&H total return
  recommendable: boolean;  // True if strategy beats B&H with statistical significance
}

export interface MultiStrategyOptimizationResult {
  results: OptimizationResult[];
  bestStrategy: OptimizationResult | null;
  ranking: { strategyId: string; strategyName: string; score: number }[];
}

const DEFAULT_CONFIG: OptimizationConfig = {
  strategyId: 'ma_crossover',
  numWindows: 5,
  trainRatio: 0.7,
  optimizationMetric: 'sharpe',
  initialCapital: 10000,
  allowShorts: false,
  transactionCost: 0.1,
};

/**
 * Extract the metric value from a backtest result
 */
function getMetricValue(result: BacktestResult, metric: OptimizationMetric): number {
  switch (metric) {
    case 'sharpe': return result.sharpeRatio;
    case 'sortino': return result.sortinoRatio;
    case 'calmar': return result.calmarRatio;
    case 'totalReturn': return result.totalReturn;
    case 'profitFactor': return result.profitFactor === Infinity ? 100 : result.profitFactor;
    default: return result.sharpeRatio;
  }
}

/**
 * Generate parameter combinations for grid search
 */
function generateParameterCombinations(
  strategy: Strategy,
  customRanges?: Record<string, { min: number; max: number; step: number }>
): Record<string, number>[] {
  const params = strategy.parameters;
  if (params.length === 0) {
    return [{}];
  }

  // Get ranges for each parameter
  const paramRanges = params.map(p => {
    const custom = customRanges?.[p.id];
    const min = custom?.min ?? p.min;
    const max = custom?.max ?? p.max;
    const step = custom?.step ?? p.step;
    
    const values: number[] = [];
    for (let v = min; v <= max; v += step) {
      values.push(v);
    }
    return { id: p.id, values };
  });

  // Generate cartesian product of all parameter values
  const combinations: Record<string, number>[] = [];
  
  function generate(index: number, current: Record<string, number>) {
    if (index === paramRanges.length) {
      combinations.push({ ...current });
      return;
    }
    
    const { id, values } = paramRanges[index];
    for (const value of values) {
      current[id] = value;
      generate(index + 1, current);
    }
  }
  
  generate(0, {});
  return combinations;
}

/**
 * Split data into walk-forward windows
 */
function createWindows(
  data: MarketData[],
  numWindows: number,
  trainRatio: number
): { train: MarketData[]; test: MarketData[]; trainStart: number; trainEnd: number; testStart: number; testEnd: number }[] {
  const windows: { train: MarketData[]; test: MarketData[]; trainStart: number; trainEnd: number; testStart: number; testEnd: number }[] = [];
  const totalPeriods = data.length;
  
  // Anchored walk-forward: each window uses all data from start to current point for training
  // and the next chunk for testing
  const testSize = Math.floor(totalPeriods / numWindows);
  
  for (let w = 0; w < numWindows; w++) {
    // Training: from start to current window boundary
    const trainEnd = Math.floor((w + 1) * totalPeriods * trainRatio / numWindows) + Math.floor(totalPeriods * (1 - trainRatio));
    const trainStart = 0;
    
    // Testing: from train end to next boundary
    const testStart = trainEnd;
    const testEnd = Math.min(testStart + testSize, totalPeriods);
    
    // Ensure we have enough data in both sets
    if (testEnd > testStart && trainEnd > trainStart + 20) {
      windows.push({
        train: data.slice(trainStart, trainEnd),
        test: data.slice(testStart, testEnd),
        trainStart,
        trainEnd,
        testStart,
        testEnd,
      });
    }
  }
  
  return windows;
}

/**
 * Run grid search on a single window to find best parameters
 */
function optimizeWindow(
  trainData: MarketData[],
  strategy: Strategy,
  combinations: Record<string, number>[],
  config: OptimizationConfig
): { bestParams: Record<string, number>; bestMetric: number } {
  let bestParams: Record<string, number> = combinations[0] || {};
  let bestMetric = -Infinity;
  
  for (const params of combinations) {
    const result = runBacktest(trainData, {
      strategyId: strategy.id,
      strategyParams: params,
      initialCapital: config.initialCapital,
      allowShorts: config.allowShorts,
      transactionCost: config.transactionCost,
    });
    
    const metric = getMetricValue(result, config.optimizationMetric);
    
    if (metric > bestMetric) {
      bestMetric = metric;
      bestParams = params;
    }
  }
  
  return { bestParams, bestMetric };
}

/**
 * Run walk-forward optimization for a single strategy
 */
export function runWalkForwardOptimization(
  data: MarketData[],
  config: Partial<OptimizationConfig> = {}
): OptimizationResult | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const strategy = strategies.find(s => s.id === cfg.strategyId);
  
  if (!strategy) {
    return null;
  }
  
  // Require minimum 200 periods for meaningful optimization
  if (data.length < 200) {
    console.warn('Walk-forward optimization requires at least 200 periods');
    return null;
  }
  
  const windows = createWindows(data, cfg.numWindows, cfg.trainRatio);
  const combinations = generateParameterCombinations(strategy, cfg.parameterRanges);
  
  const windowResults: WindowResult[] = [];
  const paramCounts: Record<string, Record<number, number>> = {};
  let combinedEquityCurve: { date: string; equity: number; window: number }[] = [];
  let runningCapital = cfg.initialCapital;
  
  // Process each window
  for (let w = 0; w < windows.length; w++) {
    const { train, test, trainStart, trainEnd, testStart, testEnd } = windows[w];
    
    // Optimize on training data
    const { bestParams, bestMetric } = optimizeWindow(train, strategy, combinations, cfg);
    
    // Test on out-of-sample data
    const testResult = runBacktest(test, {
      strategyId: strategy.id,
      strategyParams: bestParams,
      initialCapital: runningCapital,
      allowShorts: cfg.allowShorts,
      transactionCost: cfg.transactionCost,
    });
    
    const testMetric = getMetricValue(testResult, cfg.optimizationMetric);
    
    // Calculate Buy & Hold return for this test window
    const testStartPrice = test[0].close;
    const testEndPrice = test[test.length - 1].close;
    const buyHoldReturn = ((testEndPrice - testStartPrice) / testStartPrice) * 100;
    const beatsBuyHold = testResult.totalReturn > buyHoldReturn;
    
    // Track parameter selections for consensus
    for (const [paramId, value] of Object.entries(bestParams)) {
      if (!paramCounts[paramId]) paramCounts[paramId] = {};
      paramCounts[paramId][value] = (paramCounts[paramId][value] || 0) + 1;
    }
    
    // Build combined equity curve
    const windowEquity = testResult.equityCurve.map(p => ({
      date: p.date,
      equity: p.strategy,
      window: w,
    }));
    combinedEquityCurve = combinedEquityCurve.concat(windowEquity);
    
    // Update running capital for next window
    if (testResult.equityCurve.length > 0) {
      runningCapital = testResult.equityCurve[testResult.equityCurve.length - 1].strategy;
    }
    
    windowResults.push({
      windowIndex: w,
      trainStart: data[trainStart].date,
      trainEnd: data[trainEnd - 1].date,
      testStart: data[testStart].date,
      testEnd: data[Math.min(testEnd - 1, data.length - 1)].date,
      trainPeriods: train.length,
      testPeriods: test.length,
      bestParams,
      trainMetric: bestMetric,
      testMetric,
      testReturn: testResult.totalReturn,
      testSharpe: testResult.sharpeRatio,
      testMaxDrawdown: testResult.maxDrawdown,
      testTrades: testResult.totalTrades,
      buyHoldReturn,
      beatsBuyHold,
    });
  }
  
  // Calculate aggregated metrics
  const avgTestReturn = windowResults.reduce((sum, w) => sum + w.testReturn, 0) / windowResults.length;
  const avgTestSharpe = windowResults.reduce((sum, w) => sum + w.testSharpe, 0) / windowResults.length;
  const avgTestDrawdown = windowResults.reduce((sum, w) => sum + w.testMaxDrawdown, 0) / windowResults.length;
  const totalTestTrades = windowResults.reduce((sum, w) => sum + w.testTrades, 0);
  
  const avgTrainMetric = windowResults.reduce((sum, w) => sum + w.trainMetric, 0) / windowResults.length;
  const avgTestMetric = windowResults.reduce((sum, w) => sum + w.testMetric, 0) / windowResults.length;
  const overfitRatio = avgTestMetric !== 0 ? avgTrainMetric / avgTestMetric : Infinity;
  
  // Find recommended parameters (most frequently selected)
  const recommendedParams: Record<string, number> = {};
  for (const [paramId, counts] of Object.entries(paramCounts)) {
    let maxCount = 0;
    let bestValue = 0;
    for (const [value, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestValue = parseFloat(value);
      }
    }
    recommendedParams[paramId] = bestValue;
  }
  
  // Calculate consistency score (% of windows with positive test return)
  const positiveWindows = windowResults.filter(w => w.testReturn > 0).length;
  const consistencyScore = (positiveWindows / windowResults.length) * 100;
  
  // Statistical significance check (require at least 60% positive windows and positive avg return)
  const isStatisticallySignificant = consistencyScore >= 60 && avgTestReturn > 0;
  
  // Buy & Hold comparison metrics
  const avgBuyHoldReturn = windowResults.reduce((sum, w) => sum + w.buyHoldReturn, 0) / windowResults.length;
  const windowsBeatingBH = windowResults.filter(w => w.beatsBuyHold).length;
  const winRateVsBuyHold = (windowsBeatingBH / windowResults.length) * 100;
  
  // Calculate cumulative returns (compound across windows)
  const totalStrategyReturn = windowResults.reduce((acc, w) => acc * (1 + w.testReturn / 100), 1);
  const totalBuyHoldReturn = windowResults.reduce((acc, w) => acc * (1 + w.buyHoldReturn / 100), 1);
  const totalStrategyReturnPct = (totalStrategyReturn - 1) * 100;
  const totalBuyHoldReturnPct = (totalBuyHoldReturn - 1) * 100;
  const excessReturn = totalStrategyReturnPct - totalBuyHoldReturnPct;
  
  // Strategy is recommendable if it beats B&H in majority of windows AND overall
  const recommendable = winRateVsBuyHold >= 50 && excessReturn > 0 && isStatisticallySignificant;
  
  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    metric: cfg.optimizationMetric,
    avgTestReturn,
    avgTestSharpe,
    avgTestDrawdown,
    totalTestTrades,
    avgTrainMetric,
    avgTestMetric,
    overfitRatio,
    recommendedParams,
    windowResults,
    combinedEquityCurve,
    isStatisticallySignificant,
    consistencyScore,
    avgBuyHoldReturn,
    totalBuyHoldReturn: totalBuyHoldReturnPct,
    totalStrategyReturn: totalStrategyReturnPct,
    winRateVsBuyHold,
    excessReturn,
    recommendable,
  };
}

/**
 * Run walk-forward optimization for multiple strategies and rank them
 */
export function runMultiStrategyOptimization(
  data: MarketData[],
  strategyIds: string[],
  baseConfig: Omit<OptimizationConfig, 'strategyId'> = {} as any
): MultiStrategyOptimizationResult {
  const results: OptimizationResult[] = [];
  
  for (const strategyId of strategyIds) {
    const result = runWalkForwardOptimization(data, {
      ...baseConfig,
      strategyId,
    });
    
    if (result) {
      results.push(result);
    }
  }
  
  // Rank strategies by a composite score
  // Score = avgTestSharpe * consistencyScore / (overfitRatio + 1)
  const ranking = results.map(r => ({
    strategyId: r.strategyId,
    strategyName: r.strategyName,
    score: (r.avgTestSharpe * r.consistencyScore) / (r.overfitRatio + 1),
  })).sort((a, b) => b.score - a.score);
  
  const bestStrategy = results.find(r => r.strategyId === ranking[0]?.strategyId) || null;
  
  return {
    results,
    bestStrategy,
    ranking,
  };
}

/**
 * Get metric display name
 */
export function getMetricDisplayName(metric: OptimizationMetric): string {
  switch (metric) {
    case 'sharpe': return 'Sharpe Ratio';
    case 'sortino': return 'Sortino Ratio';
    case 'calmar': return 'Calmar Ratio';
    case 'totalReturn': return 'Total Return';
    case 'profitFactor': return 'Profit Factor';
    default: return metric;
  }
}

