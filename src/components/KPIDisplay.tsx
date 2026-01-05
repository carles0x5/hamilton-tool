import { MarketData } from '../utils/types';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface KPIDisplayProps {
  data: MarketData[];
  upToIndex?: number | null;
}

export default function KPIDisplay({ data, upToIndex }: KPIDisplayProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Get 20 periods ending at the selected index (or latest if not specified)
  const endIndex = upToIndex !== null && upToIndex !== undefined ? upToIndex + 1 : data.length;
  const startIndex = Math.max(0, endIndex - 20);
  const last20 = data.slice(startIndex, endIndex);

  // Calculate KPIs
  const bullishCount = last20.filter((d) => d.demand > 30).length;
  const bearishCount = last20.filter((d) => d.supply > 30).length;
  const neutralCount = last20.filter(
    (d) => Math.abs(d.demand) <= 30 && Math.abs(d.supply) <= 30
  ).length;

  const avgDemand =
    last20.reduce((sum, d) => sum + d.demand, 0) / last20.length;
  const avgSupply =
    last20.reduce((sum, d) => sum + d.supply, 0) / last20.length;

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const kpis = [
    {
      label: 'Bullish',
      value: bullishCount,
      icon: TrendingUp,
      color: 'green',
      bgGradient: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
    },
    {
      label: 'Bearish',
      value: bearishCount,
      icon: TrendingDown,
      color: 'red',
      bgGradient: 'from-red-50 to-rose-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
    },
    {
      label: 'Neutral',
      value: neutralCount,
      icon: Minus,
      color: 'gray',
      bgGradient: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-700',
    },
    {
      label: 'Avg Demand',
      value: formatPercentage(avgDemand),
      icon: BarChart3,
      color: avgDemand >= 0 ? 'green' : 'red',
      bgGradient: avgDemand >= 0 ? 'from-green-50 to-emerald-50' : 'from-red-50 to-rose-50',
      borderColor: avgDemand >= 0 ? 'border-green-200' : 'border-red-200',
      textColor: avgDemand >= 0 ? 'text-green-700' : 'text-red-700',
    },
    {
      label: 'Avg Supply',
      value: formatPercentage(avgSupply),
      icon: BarChart3,
      color: avgSupply >= 0 ? 'red' : 'green',
      bgGradient: avgSupply >= 0 ? 'from-red-50 to-rose-50' : 'from-green-50 to-emerald-50',
      borderColor: avgSupply >= 0 ? 'border-red-200' : 'border-green-200',
      textColor: avgSupply >= 0 ? 'text-red-700' : 'text-green-700',
    },
  ];

  const isHistorical = upToIndex !== null && upToIndex !== undefined && upToIndex !== data.length - 1;

  return (
    <div className="card p-2 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
          <span>KPIs ({last20.length} periods{isHistorical ? ' up to selected' : ''})</span>
        </h3>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`bg-gradient-to-br ${kpi.bgGradient} p-2 rounded border ${kpi.borderColor} transition-all duration-200 hover:shadow-sm`}
            >
              <div className="flex items-center justify-center mb-1">
                <Icon className={`w-3 h-3 ${kpi.textColor}`} />
              </div>
              <div className={`text-center text-lg font-bold ${kpi.textColor} tabular-nums mb-0.5`}>
                {kpi.value}
              </div>
              <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-center">
                {kpi.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
