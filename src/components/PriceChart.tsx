import { useState, useRef, useCallback } from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { MarketData } from '../utils/types';
import { format } from 'date-fns';
import { DollarSign, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const chartRef = useRef<HTMLDivElement>(null);
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  
  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-500 text-center">No price data available</p>
      </div>
    );
  }

  // Use all available data
  const chartData = data.map((item) => ({
    date: format(new Date(item.date), 'MMM dd'),
    fullDate: item.date,
    close: item.close,
    open: item.open,
    high: item.high,
    low: item.low,
  }));

  // Default to showing last 50 periods
  const defaultStartIndex = Math.max(0, chartData.length - 50);
  const defaultEndIndex = chartData.length - 1;
  
  const currentStartIndex = brushRange?.startIndex ?? defaultStartIndex;
  const currentEndIndex = brushRange?.endIndex ?? defaultEndIndex;
  const visibleCount = currentEndIndex - currentStartIndex + 1;

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex !== undefined && range.endIndex !== undefined) {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1; // 1 = zoom out, -1 = zoom in
    const zoomFactor = 5; // Number of periods to add/remove
    
    const start = currentStartIndex;
    const end = currentEndIndex;
    const currentRange = end - start;
    
    if (delta > 0) {
      // Zoom out - show more data
      const newStart = Math.max(0, start - zoomFactor);
      const newEnd = Math.min(chartData.length - 1, end + zoomFactor);
      setBrushRange({ startIndex: newStart, endIndex: newEnd });
    } else {
      // Zoom in - show less data (minimum 10 periods)
      if (currentRange > 10) {
        const newStart = Math.min(end - 10, start + zoomFactor);
        const newEnd = Math.max(start + 10, end - zoomFactor);
        setBrushRange({ startIndex: newStart, endIndex: newEnd });
      }
    }
  }, [currentStartIndex, currentEndIndex, chartData.length]);

  const zoomIn = () => {
    const start = currentStartIndex;
    const end = currentEndIndex;
    const currentRange = end - start;
    if (currentRange > 10) {
      const newStart = Math.min(end - 10, start + 5);
      const newEnd = Math.max(start + 10, end - 5);
      setBrushRange({ startIndex: newStart, endIndex: newEnd });
    }
  };

  const zoomOut = () => {
    const start = currentStartIndex;
    const end = currentEndIndex;
    const newStart = Math.max(0, start - 5);
    const newEnd = Math.min(chartData.length - 1, end + 5);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
  };

  const resetZoom = () => {
    setBrushRange(null);
  };

  const showAll = () => {
    setBrushRange({ startIndex: 0, endIndex: chartData.length - 1 });
  };

  return (
    <div className="card p-2 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 text-blue-600" />
          Price Chart ({visibleCount} of {chartData.length} periods)
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomIn}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Reset (Last 50)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={showAll}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Show All Data"
          >
            All
          </button>
        </div>
      </div>
      <div 
        ref={chartRef} 
        onWheel={handleWheel}
        style={{ cursor: 'ns-resize' }}
      >
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
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
              stroke="#cbd5e1"
              strokeWidth={1}
              interval="preserveStartEnd"
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
            <Brush
              dataKey="date"
              height={25}
              stroke="#3b82f6"
              fill="#f1f5f9"
              travellerWidth={8}
              startIndex={currentStartIndex}
              endIndex={currentEndIndex}
              onChange={handleBrushChange}
              tickFormatter={() => ''}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-1">
        Scroll to zoom • Drag brush below to pan
      </p>
    </div>
  );
}
