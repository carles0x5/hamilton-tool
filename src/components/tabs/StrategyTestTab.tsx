import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { OHLCVData, MarketData } from '../../utils/types';
import { runBacktest, BacktestResult } from '../../utils/backtesting';
import { strategies } from '../../utils/strategies';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Calendar,
  DollarSign,
  BarChart3,
  AlertTriangle,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';

interface StrategyTestTabProps {
  data: OHLCVData[];
  symbol: string;
}

const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

const STRATEGY_COLOR = '#10b981';

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
                <span className="text-gray-600">{entry.name}:</span>
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

const MetricCard = ({ 
  label, value, subValue, icon: Icon, colorClass, small = false 
}: { 
  label: string; value: string; subValue?: string; icon: any; colorClass: string; small?: boolean;
}) => (
  <div className={`${small ? 'p-2' : 'p-3'} rounded-lg border ${colorClass} transition-all hover:shadow-md`}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`${small ? 'w-3 h-3' : 'w-4 h-4'} opacity-70`} />
      <span className={`${small ? 'text-[10px]' : 'text-xs'} font-semibold uppercase tracking-wide opacity-80`}>{label}</span>
    </div>
    <div className={`${small ? 'text-sm' : 'text-lg'} font-bold tabular-nums`}>{value}</div>
    {subValue && <div className={`${small ? 'text-[10px]' : 'text-xs'} opacity-70 tabular-nums`}>{subValue}</div>}
  </div>
);

export default function StrategyTestTab({ data, symbol }: StrategyTestTabProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ma_crossover');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [allowShorts, setAllowShorts] = useState(false);
  const [transactionCost, setTransactionCost] = useState(0.1);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  
  // Strategy parameters
  const [strategyParams, setStrategyParams] = useState<Record<string, number>>(() => {
    const strategy = strategies.find(s => s.id === selectedStrategy);
    const params: Record<string, number> = {};
    strategy?.parameters.forEach(p => {
      params[p.id] = p.defaultValue;
    });
    return params;
  });

  // Update params when strategy changes
  const handleStrategyChange = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    const strategy = strategies.find(s => s.id === strategyId);
    const newParams: Record<string, number> = {};
    strategy?.parameters.forEach(p => {
      newParams[p.id] = p.defaultValue;
    });
    setStrategyParams(newParams);
  };

  const updateParam = (paramId: string, value: number) => {
    setStrategyParams(prev => ({ ...prev, [paramId]: value }));
  };

  // Convert OHLCV to MarketData (strategies calculate their own indicators)
  const marketData: MarketData[] = useMemo(() => {
    return data.map(d => ({ ...d, demand: 0, supply: 0 }));
  }, [data]);

  // Run backtest
  const result: BacktestResult | null = useMemo(() => {
    if (!marketData || marketData.length < 2) return null;
    return runBacktest(marketData, {
      strategyId: selectedStrategy,
      strategyParams,
      initialCapital,
      allowShorts,
      transactionCost,
    });
  }, [data, selectedStrategy, strategyParams, initialCapital, allowShorts, transactionCost]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.equityCurve.map(p => ({
      ...p,
      date: format(new Date(p.date), 'MMM dd'),
    }));
  }, [result]);

  // Trade markers
  const tradeMarkers = useMemo(() => {
    if (!result) return [];
    return result.trades.flatMap(trade => [
      { date: format(new Date(trade.entryDate), 'MMM dd'), type: 'entry', tradeType: trade.type },
      { date: format(new Date(trade.exitDate), 'MMM dd'), type: 'exit', tradeType: trade.type },
    ]);
  }, [result]);

  const strategy = strategies.find(s => s.id === selectedStrategy);

  if (!data || data.length < 2) {
    return (
      <div className="card p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium mb-2">No Data for Testing</p>
        <p className="text-gray-500">Run analysis first to test strategies</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Strategy Selection */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Single Strategy Test: {symbol}
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

        {/* Strategy Selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Strategy</label>
          <select
            value={selectedStrategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
            className="input-modern"
          >
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
            ))}
          </select>
          {strategy && (
            <p className="text-xs text-gray-500 mt-1">{strategy.description}</p>
          )}
        </div>

        {/* Strategy Parameters */}
        {strategy && strategy.parameters.length > 0 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Strategy Parameters
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {strategy.parameters.map(param => (
                <div key={param.id}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{param.name}</label>
                  {/* Special dropdown for Hamilton force calculation method */}
                  {param.id === 'method' && strategy.id === 'hamilton' ? (
                    <select
                      value={strategyParams[param.id] ?? param.defaultValue}
                      onChange={(e) => updateParam(param.id, Number(e.target.value))}
                      className="input-modern text-sm"
                    >
                      <option value={1}>MFI (Money Flow Index)</option>
                      <option value={2}>PVM (Price-Volume Momentum)</option>
                      <option value={3}>Momentum</option>
                      <option value={4}>A/D (Accumulation/Distribution)</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={strategyParams[param.id] ?? param.defaultValue}
                        onChange={(e) => updateParam(param.id, Number(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs font-bold text-gray-700 w-10 text-right tabular-nums">
                        {strategyParams[param.id] ?? param.defaultValue}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in">
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
      </div>

      {result && (
        <>
          {/* Summary Banner */}
          <div className={`card p-4 ${result.excessReturn >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {result.excessReturn >= 0 ? (
                  <ArrowUpRight className="w-8 h-8 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <p className={`text-lg font-bold ${result.excessReturn >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {strategy?.name} {result.excessReturn >= 0 ? 'Outperformed' : 'Underperformed'} Buy & Hold
                  </p>
                  <p className={`text-sm ${result.excessReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Excess return: {formatPercent(result.excessReturn)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(result.equityCurve[result.equityCurve.length - 1]?.strategy || initialCapital)}
                </p>
                <p className="text-sm text-gray-600">Final Portfolio Value</p>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Strategy Return"
              value={formatPercent(result.totalReturn)}
              subValue={`Ann: ${formatPercent(result.annualizedReturn)}`}
              icon={result.totalReturn >= 0 ? TrendingUp : TrendingDown}
              colorClass={result.totalReturn >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}
            />
            <MetricCard
              label="Buy & Hold"
              value={formatPercent(result.buyAndHoldReturn)}
              subValue={`Ann: ${formatPercent(result.annualizedBuyAndHold)}`}
              icon={result.buyAndHoldReturn >= 0 ? TrendingUp : TrendingDown}
              colorClass="bg-blue-50 border-blue-200 text-blue-800"
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${formatNumber(result.maxDrawdown)}%`}
              subValue={`B&H: -${formatNumber(result.maxDrawdownBuyAndHold)}%`}
              icon={AlertTriangle}
              colorClass="bg-amber-50 border-amber-200 text-amber-800"
            />
            <MetricCard
              label="Sharpe Ratio"
              value={formatNumber(result.sharpeRatio)}
              subValue={`Sortino: ${formatNumber(result.sortinoRatio)}`}
              icon={Award}
              colorClass={result.sharpeRatio >= 1 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-800'}
            />
            <MetricCard
              label="Win Rate"
              value={`${formatNumber(result.winRate)}%`}
              subValue={`${result.winningTrades}W / ${result.losingTrades}L`}
              icon={Target}
              colorClass={result.winRate >= 50 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-orange-50 border-orange-200 text-orange-800'}
            />
            <MetricCard
              label="Total Trades"
              value={result.totalTrades.toString()}
              subValue={`Avg ${formatNumber(result.avgHoldingPeriod, 1)} days`}
              icon={BarChart3}
              colorClass="bg-purple-50 border-purple-200 text-purple-800"
            />
          </div>

          {/* Equity Curve Chart */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Equity Curve - {strategy?.name}
              </h3>
              {result.trades.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-green-500"></div>
                    <span className="text-green-700 font-medium">▲ Entry</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-green-300"></div>
                    <span className="text-green-600 font-medium">× Exit</span>
                  </div>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="strategyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STRATEGY_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={STRATEGY_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} angle={-45} textAnchor="end" height={70} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <ReferenceLine y={initialCapital} stroke="#94a3b8" strokeDasharray="3 3" />
                {tradeMarkers.filter(m => m.type === 'entry').map((marker, idx) => (
                  <ReferenceLine key={`entry-${idx}`} x={marker.date} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 2" />
                ))}
                {tradeMarkers.filter(m => m.type === 'exit').map((marker, idx) => (
                  <ReferenceLine key={`exit-${idx}`} x={marker.date} stroke="#86efac" strokeWidth={1.5} strokeDasharray="2 2" />
                ))}
                <Area type="monotone" dataKey="strategy" stroke={STRATEGY_COLOR} strokeWidth={2} fillOpacity={1} fill="url(#strategyGradient)" name={strategy?.name || 'Strategy'} />
                <Area type="monotone" dataKey="buyAndHold" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} strokeDasharray="5 5" name="Buy & Hold" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trade History */}
          <div className="card p-4">
            <button
              onClick={() => setShowTrades(!showTrades)}
              className="w-full flex items-center justify-between text-lg font-bold text-gray-900 mb-2"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Trade History ({result.trades.length} trades)
              </span>
              {showTrades ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {showTrades && (
              <div className="overflow-x-auto animate-fade-in">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Entry Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Entry Price</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Exit Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Exit Price</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Return</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.trades.map((trade, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600">{index + 1}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            trade.type === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {trade.type === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-700 tabular-nums">{format(new Date(trade.entryDate), 'MMM dd, yyyy')}</td>
                        <td className="py-2 px-3 text-right text-gray-700 tabular-nums">${trade.entryPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-gray-700 tabular-nums">{format(new Date(trade.exitDate), 'MMM dd, yyyy')}</td>
                        <td className="py-2 px-3 text-right text-gray-700 tabular-nums">${trade.exitPrice.toFixed(2)}</td>
                        <td className={`py-2 px-3 text-right font-semibold tabular-nums ${trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(trade.returnPct)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600 tabular-nums">{trade.holdingPeriod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.trades.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No trades executed during this period</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

