import { useMemo, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import { OHLCVData, MarketData } from '../../utils/types';
import { runMultipleBacktests, BacktestResult } from '../../utils/backtesting';
import { strategies } from '../../utils/strategies';
import { format } from 'date-fns';
import {
  BarChart3,
  AlertTriangle,
  Award,
  Settings,
  ChevronDown,
  ChevronUp,
  Layers,
  GitCompare,
  Zap,
  Filter,
  Sliders,
  DollarSign,
} from 'lucide-react';

interface ComparisonTabProps {
  data: OHLCVData[];
  symbol: string;
}

const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

const STRATEGY_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const categoryStyles: Record<string, string> = {
  trend: 'bg-blue-100 text-blue-800',
  momentum: 'bg-purple-100 text-purple-800',
  'mean-reversion': 'bg-amber-100 text-amber-800',
  hybrid: 'bg-green-100 text-green-800',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-xs">
        <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-gray-600 truncate max-w-[120px]">{entry.name}:</span>
              </span>
              <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
                {formatCurrency(entry.value)}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const StrategyRow = ({ result, rank, color }: { result: BacktestResult; rank: number; color: string }) => {
  const isPositive = result.totalReturn > 0;
  const beatsBuyHold = result.excessReturn > 0;
  
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>
            {rank}
          </span>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{result.strategyName}</div>
            <div className="text-[10px] text-gray-500">{result.totalTrades} trades</div>
          </div>
        </div>
      </td>
      <td className={`py-2 px-3 text-right font-bold tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {formatPercent(result.totalReturn)}
      </td>
      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${beatsBuyHold ? 'text-green-600' : 'text-red-600'}`}>
        {formatPercent(result.excessReturn)}
      </td>
      <td className="py-2 px-3 text-right text-red-600 tabular-nums">-{formatNumber(result.maxDrawdown)}%</td>
      <td className={`py-2 px-3 text-right tabular-nums ${result.sharpeRatio >= 1 ? 'text-green-600 font-semibold' : 'text-gray-700'}`}>
        {formatNumber(result.sharpeRatio)}
      </td>
      <td className={`py-2 px-3 text-right tabular-nums ${result.winRate >= 50 ? 'text-green-600' : 'text-gray-700'}`}>
        {formatNumber(result.winRate)}%
      </td>
      <td className={`py-2 px-3 text-right tabular-nums ${result.profitFactor >= 1.5 ? 'text-green-600 font-semibold' : 'text-gray-700'}`}>
        {result.profitFactor === Infinity ? '∞' : formatNumber(result.profitFactor)}
      </td>
    </tr>
  );
};

export default function ComparisonTab({ data, symbol }: ComparisonTabProps) {
  const [initialCapital, setInitialCapital] = useState(10000);
  const [allowShorts, setAllowShorts] = useState(false);
  const [transactionCost, setTransactionCost] = useState(0.1);
  const [showSettings, setShowSettings] = useState(false);
  const [showStrategyParams, setShowStrategyParams] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['ma_crossover', 'rsi_reversion', 'macd']);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Strategy parameters
  const [strategyParams, setStrategyParams] = useState<Record<string, Record<string, number>>>(() => {
    const params: Record<string, Record<string, number>> = {};
    strategies.forEach(s => {
      params[s.id] = {};
      s.parameters.forEach(p => {
        params[s.id][p.id] = p.defaultValue;
      });
    });
    return params;
  });

  const updateStrategyParam = (strategyId: string, paramId: string, value: number) => {
    setStrategyParams(prev => ({
      ...prev,
      [strategyId]: { ...prev[strategyId], [paramId]: value },
    }));
  };

  // Convert OHLCV to MarketData (strategies calculate their own indicators)
  const marketData: MarketData[] = useMemo(() => {
    return data.map(d => ({ ...d, demand: 0, supply: 0 }));
  }, [data]);

  // Run backtests
  const results = useMemo(() => {
    if (!marketData || marketData.length < 2) return [];
    return runMultipleBacktests(marketData, selectedStrategies, {
      initialCapital,
      allowShorts,
      transactionCost,
      strategyParams,
    });
  }, [data, selectedStrategies, initialCapital, allowShorts, transactionCost, strategyParams]);

  const rankedResults = useMemo(() => {
    return [...results].sort((a, b) => b.totalReturn - a.totalReturn);
  }, [results]);

  const comparisonChartData = useMemo(() => {
    if (results.length === 0) return [];
    const baseResult = results[0];
    return baseResult.equityCurve.map((point, i) => {
      const dataPoint: any = {
        date: format(new Date(point.date), 'MMM dd'),
        buyAndHold: point.buyAndHold,
      };
      results.forEach((result) => {
        if (result.equityCurve[i]) {
          dataPoint[result.strategyId] = result.equityCurve[i].strategy;
        }
      });
      return dataPoint;
    });
  }, [results]);

  const filteredStrategies = categoryFilter 
    ? strategies.filter(s => s.category === categoryFilter)
    : strategies;

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== strategyId);
      }
      return [...prev, strategyId];
    });
  };

  if (!data || data.length < 2) {
    return (
      <div className="card p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium mb-2">No Data for Comparison</p>
        <p className="text-gray-500">Run analysis first to compare strategies</p>
      </div>
    );
  }

  const bestStrategy = rankedResults[0];
  const worstStrategy = rankedResults[rankedResults.length - 1];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-blue-600" />
              Strategy Comparison: {symbol}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {data.length > 0 && `${format(new Date(data[0].date), 'MMM dd, yyyy')} - ${format(new Date(data[data.length - 1].date), 'MMM dd, yyyy')} (${data.length} days)`}
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

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Capital ($)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="input-modern"
                  min={1000}
                  step={1000}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Cost (%)</label>
                <input
                  type="number"
                  value={transactionCost}
                  onChange={(e) => setTransactionCost(Number(e.target.value))}
                  className="input-modern"
                  min={0}
                  max={5}
                  step={0.05}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Allow Short Selling</label>
                <button
                  onClick={() => setAllowShorts(!allowShorts)}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    allowShorts ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {allowShorts ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Select Strategies to Compare
            </h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter || ''}
                onChange={(e) => setCategoryFilter(e.target.value || null)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1"
              >
                <option value="">All Categories</option>
                <option value="trend">Trend Following</option>
                <option value="momentum">Momentum</option>
                <option value="mean-reversion">Mean Reversion</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredStrategies.map((strategy) => {
              const isSelected = selectedStrategies.includes(strategy.id);
              const colorIdx = selectedStrategies.indexOf(strategy.id);
              const color = colorIdx >= 0 ? STRATEGY_COLORS[colorIdx % STRATEGY_COLORS.length] : '#9ca3af';
              
              return (
                <button
                  key={strategy.id}
                  onClick={() => toggleStrategy(strategy.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    isSelected 
                      ? 'border-transparent text-white shadow-md' 
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  style={isSelected ? { backgroundColor: color } : {}}
                  title={strategy.description}
                >
                  {isSelected && <Zap className="w-3 h-3" />}
                  <span>{strategy.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20' : categoryStyles[strategy.category]}`}>
                    {strategy.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Strategy Parameters */}
        {selectedStrategies.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowStrategyParams(!showStrategyParams)}
              className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2"
            >
              <Sliders className="w-4 h-4 text-blue-600" />
              Strategy Parameters
              {showStrategyParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showStrategyParams && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4 animate-fade-in">
                {selectedStrategies.map(strategyId => {
                  const strategy = strategies.find(s => s.id === strategyId);
                  if (!strategy || strategy.parameters.length === 0) return null;
                  
                  const colorIdx = selectedStrategies.indexOf(strategyId);
                  const color = STRATEGY_COLORS[colorIdx % STRATEGY_COLORS.length];
                  
                  return (
                    <div key={strategyId} className="pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                        <span className="font-semibold text-gray-800 text-sm">{strategy.name}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {strategy.parameters.map(param => (
                          <div key={param.id}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{param.name}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                value={strategyParams[strategyId]?.[param.id] ?? param.defaultValue}
                                onChange={(e) => updateStrategyParam(strategyId, param.id, Number(e.target.value))}
                                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                              <span className="text-xs font-bold text-gray-700 w-8 text-right tabular-nums">
                                {strategyParams[strategyId]?.[param.id] ?? param.defaultValue}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Best/Worst Summary */}
        {rankedResults.length > 1 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-green-800">Best Performer</span>
              </div>
              <div className="text-lg font-bold text-green-900">{bestStrategy?.strategyName}</div>
              <div className="text-sm text-green-700">{formatPercent(bestStrategy?.totalReturn || 0)} return</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-bold text-red-800">Worst Performer</span>
              </div>
              <div className="text-lg font-bold text-red-900">{worstStrategy?.strategyName}</div>
              <div className="text-sm text-red-700">{formatPercent(worstStrategy?.totalReturn || 0)} return</div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="card p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-blue-600" />
          Strategy Comparison (Ranked by Return)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Strategy</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Total Return</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">vs B&H</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Max DD</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Sharpe</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Win Rate</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Profit Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankedResults.map((result, rankIdx) => {
                const colorIdx = selectedStrategies.indexOf(result.strategyId);
                return (
                  <StrategyRow
                    key={result.strategyId}
                    result={result}
                    rank={rankIdx + 1}
                    color={STRATEGY_COLORS[colorIdx % STRATEGY_COLORS.length]}
                  />
                );
              })}
              {/* Buy & Hold row */}
              <tr className="bg-gray-50">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-400 text-white">-</span>
                    <div>
                      <div className="font-semibold text-gray-700 text-sm">Buy & Hold</div>
                      <div className="text-[10px] text-gray-500">Benchmark</div>
                    </div>
                  </div>
                </td>
                <td className={`py-2 px-3 text-right font-bold tabular-nums ${(results[0]?.buyAndHoldReturn || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatPercent(results[0]?.buyAndHoldReturn || 0)}
                </td>
                <td className="py-2 px-3 text-right text-gray-500">-</td>
                <td className="py-2 px-3 text-right text-red-600 tabular-nums">-{formatNumber(results[0]?.maxDrawdownBuyAndHold || 0)}%</td>
                <td className="py-2 px-3 text-right text-gray-500">-</td>
                <td className="py-2 px-3 text-right text-gray-500">-</td>
                <td className="py-2 px-3 text-right text-gray-500">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="card p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          Equity Curves Comparison
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={comparisonChartData} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} angle={-45} textAnchor="end" height={70} stroke="#cbd5e1" />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-xs font-medium text-gray-700">{value}</span>} />
            <ReferenceLine y={initialCapital} stroke="#94a3b8" strokeDasharray="3 3" />
            {results.map((result, idx) => (
              <Line
                key={result.strategyId}
                type="monotone"
                dataKey={result.strategyId}
                stroke={STRATEGY_COLORS[idx % STRATEGY_COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={result.strategyName}
              />
            ))}
            <Line type="monotone" dataKey="buyAndHold" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Buy & Hold" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

