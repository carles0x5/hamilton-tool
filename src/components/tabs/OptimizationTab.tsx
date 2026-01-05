import { useState, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { OHLCVData, MarketData } from '../../utils/types';
import { strategies } from '../../utils/strategies';
import {
  runMultiStrategyOptimization,
  OptimizationResult,
  OptimizationMetric,
  getMetricDisplayName,
} from '../../utils/walkForwardOptimizer';
import { format } from 'date-fns';
import {
  Activity,
  Target,
  BarChart3,
  AlertTriangle,
  Award,
  Settings,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  Play,
  AlertCircle,
  Loader2,
  Sliders,
  Search,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface OptimizationTabProps {
  data: OHLCVData[];
  symbol: string;
}

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

const STRATEGY_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-xs">
        <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs flex items-center justify-between gap-4">
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function OptimizationTab({ data, symbol }: OptimizationTabProps) {
  // Convert OHLCV to MarketData (strategies calculate their own indicators)
  const marketData: MarketData[] = useMemo(() => {
    return data.map(d => ({ ...d, demand: 0, supply: 0 }));
  }, [data]);

  // Configuration state
  const [numWindows, setNumWindows] = useState(5);
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [optimizationMetric, setOptimizationMetric] = useState<OptimizationMetric>('sharpe');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [allowShorts, setAllowShorts] = useState(false);
  const [transactionCost, setTransactionCost] = useState(0.1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Selected strategies for optimization
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['ma_crossover', 'rsi_reversion', 'macd']);
  
  // Results state
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [activeResult, setActiveResult] = useState<OptimizationResult | null>(null);

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== strategyId);
      }
      return [...prev, strategyId];
    });
  };

  // Run optimization
  const runOptimization = async () => {
    if (marketData.length < 200) {
      alert('Walk-forward optimization requires at least 200 data periods.');
      return;
    }

    setIsRunning(true);
    setResults([]);
    setActiveResult(null);

    // Run async to not block UI
    setTimeout(() => {
      const multiResult = runMultiStrategyOptimization(marketData, selectedStrategies, {
        numWindows,
        trainRatio,
        optimizationMetric,
        initialCapital,
        allowShorts,
        transactionCost,
      });

      setResults(multiResult.results);
      if (multiResult.bestStrategy) {
        setActiveResult(multiResult.bestStrategy);
      }
      setIsRunning(false);
    }, 100);
  };

  // Ranking chart data
  const rankingChartData = useMemo(() => {
    return results.map((r, idx) => ({
      name: r.strategyName,
      strategyReturn: r.totalStrategyReturn,
      buyHoldReturn: r.totalBuyHoldReturn,
      excessReturn: r.excessReturn,
      color: STRATEGY_COLORS[idx % STRATEGY_COLORS.length],
    })).sort((a, b) => b.excessReturn - a.excessReturn);
  }, [results]);

  // Window results chart for active strategy
  const windowChartData = useMemo(() => {
    if (!activeResult) return [];
    return activeResult.windowResults.map((w, idx) => ({
      window: `W${idx + 1}`,
      trainMetric: w.trainMetric,
      testMetric: w.testMetric,
      testReturn: w.testReturn,
    }));
  }, [activeResult]);

  if (marketData.length < 200) {
    return (
      <div className="card p-12 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium mb-2">Insufficient Data for Optimization</p>
        <p className="text-gray-500 mb-4">
          Walk-forward optimization requires at least 200 data periods for meaningful results.
        </p>
        <p className="text-sm text-gray-400">
          Current data: {marketData.length} periods. Need {200 - marketData.length} more.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Configuration */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-600" />
              Walk-Forward Optimization: {symbol}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Find optimal strategy parameters with out-of-sample validation
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Optimization Settings */}
        <div className={`mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 ${showSettings ? '' : 'hidden'}`}>
          <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            Optimization Settings
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Windows (3-10)</label>
              <input
                type="number"
                value={numWindows}
                onChange={(e) => setNumWindows(Math.max(3, Math.min(10, Number(e.target.value))))}
                className="input-modern text-sm"
                min={3}
                max={10}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Train Ratio</label>
              <input
                type="number"
                value={trainRatio}
                onChange={(e) => setTrainRatio(Math.max(0.5, Math.min(0.9, Number(e.target.value))))}
                className="input-modern text-sm"
                min={0.5}
                max={0.9}
                step={0.05}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Optimize For</label>
              <select
                value={optimizationMetric}
                onChange={(e) => setOptimizationMetric(e.target.value as OptimizationMetric)}
                className="input-modern text-sm"
              >
                <option value="sharpe">Sharpe Ratio</option>
                <option value="sortino">Sortino Ratio</option>
                <option value="calmar">Calmar Ratio</option>
                <option value="totalReturn">Total Return</option>
                <option value="profitFactor">Profit Factor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Initial Capital</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="input-modern text-sm"
                min={1000}
                step={1000}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Trans. Cost (%)</label>
              <input
                type="number"
                value={transactionCost}
                onChange={(e) => setTransactionCost(Number(e.target.value))}
                className="input-modern text-sm"
                min={0}
                max={5}
                step={0.05}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Allow Shorts</label>
              <button
                onClick={() => setAllowShorts(!allowShorts)}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  allowShorts ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {allowShorts ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Select Strategies to Optimize
          </h3>
          <div className="flex flex-wrap gap-2">
            {strategies.map((strategy, idx) => {
              const isSelected = selectedStrategies.includes(strategy.id);
              const color = STRATEGY_COLORS[idx % STRATEGY_COLORS.length];
              
              return (
                <button
                  key={strategy.id}
                  onClick={() => toggleStrategy(strategy.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    isSelected 
                      ? 'border-transparent text-white shadow-md' 
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                  style={isSelected ? { backgroundColor: color } : {}}
                  title={strategy.description}
                >
                  {isSelected && <Zap className="w-3 h-3" />}
                  <span>{strategy.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runOptimization}
          disabled={isRunning || selectedStrategies.length === 0}
          className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Running Optimization...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Run Walk-Forward Optimization
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Strategy Ranking */}
          <div className="card p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Strategy Ranking (Out-of-Sample Performance vs Buy & Hold)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Strategy</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Total Return</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Buy & Hold</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Excess Return</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Win Rate vs B&H</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Consistency</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">Recommendable</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results
                    .sort((a, b) => b.excessReturn - a.excessReturn)
                    .map((result, idx) => {
                      const color = STRATEGY_COLORS[strategies.findIndex(s => s.id === result.strategyId) % STRATEGY_COLORS.length];
                      const isActive = activeResult?.strategyId === result.strategyId;
                      
                      return (
                        <tr 
                          key={result.strategyId} 
                          className={`hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                        >
                          <td className="py-2 px-3">
                            <span 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: color }}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-gray-900">{result.strategyName}</td>
                          <td className={`py-2 px-3 text-right font-bold tabular-nums ${result.totalStrategyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(result.totalStrategyReturn)}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${result.totalBuyHoldReturn >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatPercent(result.totalBuyHoldReturn)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${result.excessReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {result.excessReturn >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {formatPercent(result.excessReturn)}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${result.winRateVsBuyHold >= 50 ? 'text-green-600 font-semibold' : 'text-amber-600'}`}>
                            {formatNumber(result.winRateVsBuyHold)}%
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${result.consistencyScore >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                            {formatNumber(result.consistencyScore)}%
                          </td>
                          <td className="py-2 px-3 text-center">
                            {result.recommendable ? (
                              <ThumbsUp className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <ThumbsDown className="w-5 h-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => setActiveResult(result)}
                              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                isActive 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            
            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-green-600" />
                Recommendable: Beats B&H in majority of windows with positive excess return
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                Excess Return: Strategy return minus Buy & Hold return
              </span>
            </div>
          </div>

          {/* Ranking Chart */}
          <div className="card p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Strategy vs Buy & Hold (Out-of-Sample Returns)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankingChartData} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="strategyReturn" name="Strategy Return (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="buyHoldReturn" name="Buy & Hold (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active Strategy Detail */}
          {activeResult && (
            <>
              {/* Strategy Summary */}
              <div className="card p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  {activeResult.strategyName} - Optimization Details
                </h3>
                
                {/* Buy & Hold Comparison Banner */}
                {activeResult.recommendable ? (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <ThumbsUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-800">Strategy Beats Buy & Hold</p>
                      <p className="text-sm text-green-700">
                        Excess return of {formatPercent(activeResult.excessReturn)} with {formatNumber(activeResult.winRateVsBuyHold)}% win rate vs B&H across test windows.
                        This strategy is recommended for use.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <ThumbsDown className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Buy & Hold Outperforms This Strategy</p>
                      <p className="text-sm text-red-700">
                        {activeResult.excessReturn < 0 
                          ? `Strategy underperforms B&H by ${formatPercent(Math.abs(activeResult.excessReturn))}.`
                          : `Only beats B&H in ${formatNumber(activeResult.winRateVsBuyHold)}% of windows.`}
                        {' '}Consider using Buy & Hold or a different strategy.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Warnings */}
                {activeResult.overfitRatio > 2 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">Potential Overfitting Detected</p>
                      <p className="text-sm text-amber-700">
                        Train/Test ratio of {formatNumber(activeResult.overfitRatio)}x suggests parameters may be overfit to training data.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recommended Parameters */}
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Recommended Parameters
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(activeResult.recommendedParams).map(([key, value]) => (
                      <div key={key} className="bg-white px-3 py-1.5 rounded border border-green-200">
                        <span className="text-xs text-green-600 font-medium">{key}:</span>
                        <span className="ml-2 font-bold text-green-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs text-green-600 mb-1">Total Strategy</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.totalStrategyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(activeResult.totalStrategyReturn)}
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-600 mb-1">Total Buy & Hold</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.totalBuyHoldReturn >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatPercent(activeResult.totalBuyHoldReturn)}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${activeResult.excessReturn >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className={`text-xs mb-1 ${activeResult.excessReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>Excess Return</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.excessReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(activeResult.excessReturn)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Win Rate vs B&H</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.winRateVsBuyHold >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                      {formatNumber(activeResult.winRateVsBuyHold)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Avg Sharpe</div>
                    <div className="text-lg font-bold tabular-nums text-gray-900">
                      {formatNumber(activeResult.avgTestSharpe)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Avg Max DD</div>
                    <div className="text-lg font-bold tabular-nums text-red-600">
                      -{formatNumber(activeResult.avgTestDrawdown)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Consistency</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.consistencyScore >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                      {formatNumber(activeResult.consistencyScore)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Overfit Ratio</div>
                    <div className={`text-lg font-bold tabular-nums ${activeResult.overfitRatio > 2 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatNumber(activeResult.overfitRatio)}x
                    </div>
                  </div>
                </div>

                {/* Window Results Chart */}
                <h4 className="font-semibold text-gray-800 mb-3">Train vs Test Performance by Window</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={windowChartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="window" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="trainMetric" name={`Train ${getMetricDisplayName(optimizationMetric)}`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="testMetric" name={`Test ${getMetricDisplayName(optimizationMetric)}`} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Window Details Table */}
              <div className="card p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Window-by-Window Results vs Buy & Hold</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Window</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Test Period</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Strategy Return</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Buy & Hold</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Winner</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Test Sharpe</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Max DD</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Trades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeResult.windowResults.map((w) => (
                        <tr key={w.windowIndex} className={`hover:bg-gray-50 ${w.beatsBuyHold ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                          <td className="py-2 px-3 font-semibold text-gray-900">W{w.windowIndex + 1}</td>
                          <td className="py-2 px-3 text-gray-600 text-xs">
                            {format(new Date(w.testStart), 'MMM dd')} - {format(new Date(w.testEnd), 'MMM dd')}
                            <br />
                            <span className="text-gray-400">({w.testPeriods} days)</span>
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums font-bold ${w.testReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(w.testReturn)}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums font-medium ${w.buyHoldReturn >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatPercent(w.buyHoldReturn)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {w.beatsBuyHold ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                <TrendingUp className="w-3 h-3" />
                                Strategy
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                <TrendingDown className="w-3 h-3" />
                                B&H
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${w.testSharpe >= 1 ? 'text-green-600 font-semibold' : 'text-gray-700'}`}>
                            {formatNumber(w.testSharpe)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-red-600">
                            -{formatNumber(w.testMaxDrawdown)}%
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                            {w.testTrades}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr className="font-semibold">
                        <td className="py-2 px-3 text-gray-900">Total</td>
                        <td className="py-2 px-3 text-gray-600">All Windows</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${activeResult.totalStrategyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(activeResult.totalStrategyReturn)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${activeResult.totalBuyHoldReturn >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatPercent(activeResult.totalBuyHoldReturn)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {activeResult.excessReturn >= 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-200 text-green-800">
                              Strategy +{formatNumber(activeResult.excessReturn)}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-200 text-blue-800">
                              B&H +{formatNumber(Math.abs(activeResult.excessReturn))}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                          {formatNumber(activeResult.avgTestSharpe)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-600">
                          -{formatNumber(activeResult.avgTestDrawdown)}%
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                          {activeResult.totalTestTrades}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Empty State */}
      {results.length === 0 && !isRunning && (
        <div className="card p-12 text-center">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium mb-2">Ready to Optimize</p>
          <p className="text-gray-500">
            Select strategies and click "Run Walk-Forward Optimization" to find optimal parameters
          </p>
        </div>
      )}
    </div>
  );
}

