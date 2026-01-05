import { Timeframe } from '../utils/types';
import { Calendar, Clock } from 'lucide-react';

interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const timeframes: { value: Timeframe; label: string; icon: typeof Calendar }[] = [
  { value: 'daily', label: 'Daily', icon: Calendar },
  { value: 'weekly', label: 'Weekly', icon: Calendar },
  { value: 'hourly', label: '1 Hour', icon: Clock },
];

export default function TimeframeSelector({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Timeframe
      </label>
      <div className="flex space-x-3">
        {timeframes.map((tf) => {
          const Icon = tf.icon;
          const isSelected = selectedTimeframe === tf.value;
          return (
            <label
              key={tf.value}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-md'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <input
                type="radio"
                value={tf.value}
                checked={isSelected}
                onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
                className="sr-only"
              />
              <span className="text-sm">{tf.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
