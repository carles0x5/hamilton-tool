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
import { MarketData } from '../utils/types';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

interface ForceChartProps {
  data: MarketData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const demand = payload.find((p: any) => p.dataKey === 'demand')?.value || 0;
    const supply = payload.find((p: any) => p.dataKey === 'supply')?.value || 0;
    const netForce = demand - supply;
    
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border-2 border-gray-200 backdrop-blur-sm">
        <p className="text-sm font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs font-semibold text-gray-600">Demand</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${demand >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {demand >= 0 ? '+' : ''}{demand.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs font-semibold text-gray-600">Supply</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${supply >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {supply >= 0 ? '+' : ''}{supply.toFixed(1)}%
            </span>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Force</span>
              <span className={`text-sm font-bold tabular-nums ${netForce >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netForce >= 0 ? '+' : ''}{netForce.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ForceChart({ data }: ForceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-500 text-center">No force data available</p>
      </div>
    );
  }

  // Get last 50 periods
  const chartData = data.slice(-50).map((item) => ({
    date: format(new Date(item.date), 'MMM dd'),
    fullDate: item.date,
    demand: Number(item.demand.toFixed(1)),
    supply: Number(item.supply.toFixed(1)),
  }));

  return (
    <div className="card p-2 animate-fade-in">
      <h3 className="text-xs font-bold mb-1.5 text-gray-900 flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-blue-600" />
        Demand/Supply Forces (Last 50)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 45 }}>
          <defs>
            <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }}
            angle={-45}
            textAnchor="end"
            height={60}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
            domain={[-100, 100]}
            stroke="#cbd5e1"
            strokeWidth={1}
            tickFormatter={(value) => `${value}%`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '5px', paddingBottom: '5px' }}
            iconType="line"
            iconSize={10}
            formatter={(value) => <span className="text-[10px] font-semibold text-gray-700">{value}</span>}
          />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" strokeWidth={2} opacity={0.6} />
          <ReferenceLine y={30} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} strokeWidth={1} />
          <ReferenceLine y={-30} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="demand"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#demandGradient)"
            fillOpacity={1}
            activeDot={{ r: 7, fill: '#10b981', stroke: '#ffffff', strokeWidth: 3, filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))' }}
            name="Demand Force"
          />
          <Area
            type="monotone"
            dataKey="supply"
            stroke="#ef4444"
            strokeWidth={3}
            fill="url(#supplyGradient)"
            fillOpacity={1}
            activeDot={{ r: 7, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 3, filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' }}
            name="Supply Force"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
