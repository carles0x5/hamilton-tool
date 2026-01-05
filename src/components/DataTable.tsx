import { MarketData } from '../utils/types';
import { format } from 'date-fns';
import { Database, MousePointerClick } from 'lucide-react';
import { createTradingSignal, DEFAULT_THRESHOLD } from '../utils/diagramLogic';

interface DataTableProps {
  data: MarketData[];
  selectedIndex?: number | null;
  onRowClick?: (index: number) => void;
  threshold?: number;
}

// Signal action colors
const getSignalColor = (action: string): string => {
  switch (action) {
    case 'LONG':
      return 'bg-green-600 text-white';
    case 'SHORT':
      return 'bg-red-600 text-white';
    case 'HOLD_LONG':
    case 'ACCUMULATE':
      return 'bg-green-100 text-green-800';
    case 'HOLD_SHORT':
    case 'REDUCE':
      return 'bg-red-100 text-red-800';
    case 'EXIT_LONG':
    case 'EXIT_SHORT':
      return 'bg-amber-100 text-amber-800';
    case 'WAIT':
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function DataTable({ data, selectedIndex, onRowClick, threshold = DEFAULT_THRESHOLD }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-3 h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  // Get last 50 periods for display
  const displayData = data.slice(-50).reverse();

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="card p-2 flex flex-col animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">Market Data (Last 50)</h3>
        </div>
        {onRowClick && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <MousePointerClick className="w-3 h-3" />
            <span>Click row to analyze</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ minHeight: 0 }}>
        <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Date</th>
                <th className="text-right py-1.5 px-1 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Open</th>
                <th className="text-right py-1.5 px-1 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">High</th>
                <th className="text-right py-1.5 px-1 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Low</th>
                <th className="text-right py-1.5 px-1 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Close</th>
                <th className="text-right py-1.5 px-1 font-semibold text-blue-700 text-[10px] uppercase tracking-wide">Chg%</th>
                <th className="text-right py-1.5 px-1 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Volume</th>
                <th className="text-right py-1.5 px-1 font-semibold text-green-700 text-[10px] uppercase tracking-wide">Demand</th>
                <th className="text-right py-1.5 px-1 font-semibold text-red-700 text-[10px] uppercase tracking-wide">Supply</th>
                <th className="text-center py-1.5 px-1 font-semibold text-purple-700 text-[10px] uppercase tracking-wide">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayData.map((row, index) => {
                // Calculate the actual index in the original data array
                const actualIndex = data.length - 1 - index;
                const isSelected = selectedIndex === actualIndex;
                
                // Calculate percentage change from previous close
                // displayData is reversed, so previous period is at index + 1
                const prevRow = displayData[index + 1];
                const priceChange = prevRow 
                  ? ((row.close - prevRow.close) / prevRow.close) * 100 
                  : 0;
                
                // Calculate signal for this period
                const rowSignal = createTradingSignal(row.demand, row.supply, threshold);
                
                return (
                <tr 
                  key={index} 
                  className={`transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-100 hover:bg-blue-100 border-l-2 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onRowClick?.(actualIndex)}
                >
                  <td className={`py-1 px-2 font-medium tabular-nums ${isSelected ? 'text-blue-900' : 'text-gray-600'}`}>
                    {format(new Date(row.date), 'MMM dd')}
                  </td>
                  <td className="py-1 px-1 text-right text-gray-700 tabular-nums">
                    ${row.open.toFixed(2)}
                  </td>
                  <td className="py-1 px-1 text-right text-gray-700 tabular-nums">
                    ${row.high.toFixed(2)}
                  </td>
                  <td className="py-1 px-1 text-right text-gray-700 tabular-nums">
                    ${row.low.toFixed(2)}
                  </td>
                  <td className="py-1 px-1 text-right font-semibold text-gray-900 tabular-nums">
                    ${row.close.toFixed(2)}
                  </td>
                  <td className={`py-1 px-1 text-right font-semibold tabular-nums ${
                    priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {prevRow ? formatPercentage(priceChange) : '—'}
                  </td>
                  <td className="py-1 px-1 text-right text-gray-600 tabular-nums">
                    {(row.volume / 1000000).toFixed(2)}M
                  </td>
                  <td className={`py-1 px-1 text-right font-semibold tabular-nums ${
                    row.demand >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatPercentage(row.demand)}
                  </td>
                  <td className={`py-1 px-1 text-right font-semibold tabular-nums ${
                    row.supply >= 0 ? 'text-red-700' : 'text-green-700'
                  }`}>
                    {formatPercentage(row.supply)}
                  </td>
                  <td className="py-1 px-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${getSignalColor(rowSignal.action)}`}>
                      {rowSignal.action.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
      </div>
    </div>
  );
}

