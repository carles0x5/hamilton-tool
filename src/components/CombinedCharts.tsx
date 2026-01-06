import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { MarketData } from '../utils/types';
import { format } from 'date-fns';
import { DollarSign, Activity, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface CombinedChartsProps {
  data: MarketData[];
}

// Price Chart Tooltip
const PriceTooltip = ({ active, payload, label }: any) => {
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

// Force Chart Tooltip
const ForceTooltip = ({ active, payload, label }: any) => {
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

export default function CombinedCharts({ data }: CombinedChartsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartRange, setDragStartRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  
  // Disable page scroll when hovering over charts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: WheelEvent) => {
      if (isHovering) {
        e.preventDefault();
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', preventScroll, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', preventScroll);
    };
  }, [isHovering]);

  // Handle mouse drag for panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !chartsRef.current || !dragStartRange) return;
      
      const chartWidth = chartsRef.current.offsetWidth;
      const deltaX = e.clientX - dragStartX;
      const dataLength = data.length;
      const visibleRange = dragStartRange.endIndex - dragStartRange.startIndex;
      
      // Calculate how many periods to shift based on drag distance
      // Positive deltaX (drag right) = show later data, negative deltaX (drag left) = show earlier data
      const periodsPerPixel = visibleRange / chartWidth;
      const periodShift = Math.round(deltaX * periodsPerPixel);
      
      let newStart = dragStartRange.startIndex + periodShift;
      let newEnd = dragStartRange.endIndex + periodShift;
      
      // Clamp to valid range
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd >= dataLength) {
        newStart -= (newEnd - dataLength + 1);
        newEnd = dataLength - 1;
      }
      newStart = Math.max(0, newStart);
      
      setBrushRange({ startIndex: newStart, endIndex: newEnd });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartRange(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartRange, data.length]);

  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-500 text-center">No chart data available</p>
      </div>
    );
  }

  // Use all available data with year in date format
  const chartData = data.map((item) => ({
    date: format(new Date(item.date), "MMM dd ''yy"),
    fullDate: item.date,
    close: item.close,
    open: item.open,
    high: item.high,
    low: item.low,
    demand: Number(item.demand.toFixed(1)),
    supply: Number(item.supply.toFixed(1)),
  }));

  // Default to showing last 50 periods
  const defaultStartIndex = Math.max(0, chartData.length - 50);
  const defaultEndIndex = chartData.length - 1;
  
  const currentStartIndex = brushRange?.startIndex ?? defaultStartIndex;
  const currentEndIndex = brushRange?.endIndex ?? defaultEndIndex;
  const visibleCount = currentEndIndex - currentStartIndex + 1;
  
  // Slice data to visible range for the main charts
  const visibleData = chartData.slice(currentStartIndex, currentEndIndex + 1);

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex !== undefined && range.endIndex !== undefined) {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
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

  const panLeft = () => {
    const start = currentStartIndex;
    const end = currentEndIndex;
    const panAmount = Math.max(1, Math.round((end - start) * 0.2)); // Pan 20% of visible range
    const newStart = Math.max(0, start - panAmount);
    const newEnd = end - (start - newStart);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
  };

  const panRight = () => {
    const start = currentStartIndex;
    const end = currentEndIndex;
    const panAmount = Math.max(1, Math.round((end - start) * 0.2)); // Pan 20% of visible range
    const newEnd = Math.min(chartData.length - 1, end + panAmount);
    const newStart = start + (newEnd - end);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartRange({ startIndex: currentStartIndex, endIndex: currentEndIndex });
  };

  return (
    <div 
      ref={containerRef}
      className="card p-3 animate-fade-in"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Header with zoom and pan controls */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-blue-600" />
          Price & Force Charts
          <span className="text-xs font-normal text-gray-500">
            ({visibleCount} of {chartData.length} periods)
          </span>
        </h3>
        <div className="flex items-center gap-1">
          {/* Pan controls */}
          <button
            onClick={panLeft}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30"
            title="Pan Left"
            disabled={currentStartIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={panRight}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30"
            title="Pan Right"
            disabled={currentEndIndex === chartData.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-gray-300 mx-1" />
          
          {/* Zoom controls */}
          <button
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Reset (Last 50)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={showAll}
            className="px-2 py-1 text-xs font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Show All Data"
          >
            All
          </button>
        </div>
      </div>

      {/* Charts Container */}
      <div 
        ref={chartsRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        className="select-none"
      >
        {/* Price Chart */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-semibold text-gray-700">Price</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={visibleData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="priceGradientCombined" x1="0" y1="0" x2="0" y2="1">
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
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                domain={['auto', 'auto']}
                stroke="#cbd5e1"
                strokeWidth={1}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                width={55}
              />
              <Tooltip content={<PriceTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#priceGradientCombined)"
                fillOpacity={1}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Force Chart */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-emerald-600" />
            <span className="text-xs font-semibold text-gray-700">Demand / Supply Forces</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={visibleData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="demandGradientCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="supplyGradientCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }}
                stroke="#cbd5e1"
                strokeWidth={1}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                domain={[-100, 100]}
                stroke="#cbd5e1"
                strokeWidth={1}
                tickFormatter={(value) => `${value}%`}
                width={55}
              />
              <Tooltip content={<ForceTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '2px' }}
                iconType="line"
                iconSize={8}
                formatter={(value) => <span className="text-[10px] font-semibold text-gray-600">{value}</span>}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" strokeWidth={1.5} opacity={0.6} />
              <ReferenceLine y={30} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} strokeWidth={1} />
              <ReferenceLine y={-30} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} strokeWidth={1} />
              <Area
                type="monotone"
                dataKey="demand"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#demandGradientCombined)"
                fillOpacity={1}
                activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                name="Demand"
              />
              <Area
                type="monotone"
                dataKey="supply"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#supplyGradientCombined)"
                fillOpacity={1}
                activeDot={{ r: 5, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                name="Supply"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Shared Brush Control */}
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={chartData} margin={{ top: 0, right: 10, left: 5, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 8, fill: '#94a3b8' }}
              stroke="#cbd5e1"
              strokeWidth={1}
              interval="preserveStartEnd"
              hide
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#94a3b8"
              strokeWidth={1}
              fill="#e2e8f0"
              fillOpacity={0.5}
            />
            <Brush
              dataKey="date"
              height={30}
              stroke="#3b82f6"
              fill="#f8fafc"
              travellerWidth={10}
              startIndex={currentStartIndex}
              endIndex={currentEndIndex}
              onChange={handleBrushChange}
              tickFormatter={(value) => value}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-gray-400 text-center mt-1">
        Scroll to zoom • Drag chart or brush to pan • Use ← → buttons to navigate
      </p>
    </div>
  );
}

