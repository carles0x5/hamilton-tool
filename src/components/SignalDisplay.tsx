import { TradingSignal } from '../utils/types';
import { getPositionName } from '../utils/diagramLogic';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface SignalDisplayProps {
  signal: TradingSignal | null;
}

export default function SignalDisplay({ signal }: SignalDisplayProps) {
  if (!signal) {
    return (
      <div className="card p-2 h-full flex items-center justify-center animate-fade-in">
        <p className="text-gray-500 text-sm">No signal data available</p>
      </div>
    );
  }

  const getActionColor = (action: TradingSignal['action']) => {
    switch (action) {
      case 'LONG':
      case 'HOLD_LONG':
      case 'ACCUMULATE':
        return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-600';
      case 'SHORT':
      case 'HOLD_SHORT':
      case 'REDUCE':
        return 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-600';
      case 'EXIT_LONG':
      case 'EXIT_SHORT':
        return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-600';
      case 'WAIT':
      default:
        return 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border-gray-600';
    }
  };

  const getActionIcon = (action: TradingSignal['action']) => {
    switch (action) {
      case 'LONG':
      case 'HOLD_LONG':
      case 'ACCUMULATE':
        return <TrendingUp className="w-3 h-3" />;
      case 'SHORT':
      case 'HOLD_SHORT':
      case 'REDUCE':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getQualityColor = (quality: TradingSignal['quality']) => {
    switch (quality) {
      case 'Healthy':
        return 'badge-success';
      case 'Warning':
        return 'badge-danger';
      case 'Speculative':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  };

  const getQualityIcon = (quality: TradingSignal['quality']) => {
    switch (quality) {
      case 'Healthy':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'Warning':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <XCircle className="w-3 h-3" />;
    }
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="card p-2 animate-fade-in" style={{ flexShrink: 0 }}>
      <h3 className="text-xs font-bold mb-2 text-gray-900 flex items-center gap-1">
        <div className="w-0.5 h-3 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
        Current Signal
      </h3>
      
      <div className="space-y-2">
        {/* Position and Action in one row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-gray-50 to-white p-1.5 rounded border border-gray-200">
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Position
            </label>
            <p className="text-sm font-bold text-gray-900">
              {getPositionName(signal.position)}
            </p>
          </div>
          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Action
            </label>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded border font-bold text-xs shadow-sm ${getActionColor(signal.action)}`}
            >
              {getActionIcon(signal.action)}
              {signal.action.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Forces */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-1.5 rounded border border-green-200">
            <label className="text-[9px] font-semibold text-gray-600 mb-1 block">
              Demand
            </label>
            <p
              className={`text-base font-bold tabular-nums ${
                signal.demand >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {formatPercentage(signal.demand)}
            </p>
            <div className="mt-1 text-[9px] text-gray-600 font-medium">
              {signal.demand > 30 ? 'Strong ↑' : 
               signal.demand < -30 ? 'Weak ↓' : 
               'Neutral →'}
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-1.5 rounded border border-red-200">
            <label className="text-[9px] font-semibold text-gray-600 mb-1 block">
              Supply
            </label>
            <p
              className={`text-base font-bold tabular-nums ${
                signal.supply >= 0 ? 'text-red-700' : 'text-green-700'
              }`}
            >
              {formatPercentage(signal.supply)}
            </p>
            <div className="mt-1 text-[9px] text-gray-600 font-medium">
              {signal.supply > 30 ? 'Strong →' : 
               signal.supply < -30 ? 'Weak ←' : 
               'Neutral →'}
            </div>
          </div>
        </div>

        {/* Quality Assessment */}
        <div>
          <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
            Quality
          </label>
          <span className={`badge ${getQualityColor(signal.quality)} flex items-center gap-1 px-2 py-1 text-[10px] w-fit`}>
            {getQualityIcon(signal.quality)}
            {signal.quality}
          </span>
        </div>
      </div>
    </div>
  );
}
