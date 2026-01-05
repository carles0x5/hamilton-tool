import { CalculationMethod } from '../utils/types';
import { Calculator } from 'lucide-react';

interface MethodSelectorProps {
  selectedMethod: CalculationMethod;
  onMethodChange: (method: CalculationMethod) => void;
}

const methods: {
  value: CalculationMethod;
  label: string;
  description: string;
}[] = [
  {
    value: 'A',
    label: 'MFI',
    description: 'Money Flow Index: Volume-weighted price momentum (14-period)',
  },
  {
    value: 'B',
    label: 'PVM',
    description: 'Price-Volume Momentum: CLV × volume with rolling normalization',
  },
  {
    value: 'C',
    label: 'RSI-Vol',
    description: 'RSI-Volume Hybrid: RSI momentum with volume confirmation',
  },
  {
    value: 'D',
    label: 'CMF',
    description: 'Chaikin Money Flow: Institutional accumulation/distribution (21-period)',
  },
];

export default function MethodSelector({
  selectedMethod,
  onMethodChange,
}: MethodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
        <Calculator className="w-4 h-4" />
        Calculation Method
      </label>
      <select
        value={selectedMethod}
        onChange={(e) => onMethodChange(e.target.value as CalculationMethod)}
        className="select-modern"
      >
        {methods.map((method) => (
          <option key={method.value} value={method.value}>
            {method.label} - {method.description}
          </option>
        ))}
      </select>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
        <p className="text-xs text-blue-800 font-medium">
          {methods.find((m) => m.value === selectedMethod)?.description}
        </p>
      </div>
    </div>
  );
}
