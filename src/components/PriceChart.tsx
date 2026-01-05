import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MarketData } from '../utils/types';
import { format } from 'date-fns';
import { DollarSign } from 'lucide-react';

interface PriceChartProps {
  data: MarketData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const priceChange = data.close - data.open;
    const priceChangePercent = ((priceChange / data.open) * 100).toFixed(2);
    const isPositive = priceChange >= 0;
    
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border-2 border-blue-200 backdrop-blur-sm">
        <p className="text-sm font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{label}</p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Open</p>
              <p className="text-sm font-semibold text-gray-700">${data.open.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">High</p>
              <p className="text-sm font-semibold text-green-600">${data.high.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Low</p>
              <p className="text-sm font-semibold text-red-600">${data.low.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Close</p>
              <p className="text-base font-bold text-blue-600">${data.close.toFixed(2)}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '↑' : '↓'} ${Math.abs(priceChange).toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent}%)
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ data }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-500 text-center">No price data available</p>
      </div>
    );
  }

  // Get last 50 periods
  const chartData = data.slice(-50).map((item) => ({
    date: format(new Date(item.date), 'MMM dd'),
    fullDate: item.date,
    close: item.close,
    open: item.open,
    high: item.high,
    low: item.low,
  }));

  return (
    <div className="card p-2 animate-fade-in">
      <h3 className="text-xs font-bold mb-1.5 text-gray-900 flex items-center gap-1.5">
        <DollarSign className="w-3 h-3 text-blue-600" />
        Price Chart (Last 50)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 45 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
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
            domain={['auto', 'auto']}
            stroke="#cbd5e1"
            strokeWidth={1}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={3}
            fill="url(#priceGradient)"
            fillOpacity={1}
            activeDot={{ r: 7, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3, filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
