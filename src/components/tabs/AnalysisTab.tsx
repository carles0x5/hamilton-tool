import { useState, useEffect, useMemo } from 'react';
import { OHLCVData, MarketData, TradingSignal, CalculationMethod } from '../../utils/types';
import { calculateForces } from '../../utils/calculations';
import { createTradingSignal } from '../../utils/diagramLogic';
import HamiltonDiagram from '../HamiltonDiagram';
import SignalDisplay from '../SignalDisplay';
import DataTable from '../DataTable';
import CombinedCharts from '../CombinedCharts';
import KPIDisplay from '../KPIDisplay';
import MethodSelector from '../MethodSelector';
import { History, RotateCcw, Sliders, Calculator } from 'lucide-react';

interface AnalysisTabProps {
  rawData: OHLCVData[];
}

export default function AnalysisTab({ rawData }: AnalysisTabProps) {
  // Hamilton-specific parameters
  const [selectedMethod, setSelectedMethod] = useState<CalculationMethod>('B');
  const [threshold, setThreshold] = useState<number>(30);
  
  // UI state
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number | null>(null);
  const [signal, setSignal] = useState<TradingSignal | null>(null);

  // Calculate forces using selected method
  const marketData: MarketData[] = useMemo(() => {
    if (rawData.length === 0) return [];
    return calculateForces(rawData, selectedMethod);
  }, [rawData, selectedMethod]);

  // Update signal when selected period or threshold changes
  useEffect(() => {
    if (marketData.length > 0) {
      const index = selectedPeriodIndex ?? marketData.length - 1;
      const selectedData = marketData[index];
      if (selectedData) {
        const newSignal = createTradingSignal(selectedData.demand, selectedData.supply, threshold);
        setSignal(newSignal);
      }
    }
  }, [selectedPeriodIndex, threshold, marketData]);

  // Reset selected period when data changes
  useEffect(() => {
    setSelectedPeriodIndex(null);
  }, [rawData]);

  // Handle period selection from table
  const handlePeriodSelect = (index: number) => {
    if (selectedPeriodIndex === index) {
      setSelectedPeriodIndex(null);
    } else {
      setSelectedPeriodIndex(index);
    }
  };

  // Get currently viewed data (selected or latest)
  const viewedData = marketData.length > 0 
    ? marketData[selectedPeriodIndex ?? marketData.length - 1] 
    : null;
  
  const isViewingHistorical = selectedPeriodIndex !== null && selectedPeriodIndex !== marketData.length - 1;

  if (rawData.length === 0) {
    return null;
  }

  return (
    <>
      {/* Hamilton Parameters */}
      <div className="card p-4 mb-3 animate-fade-in">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          Hamilton Diagram Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calculation Method */}
          <MethodSelector
            selectedMethod={selectedMethod}
            onMethodChange={setSelectedMethod}
          />
          
          {/* Threshold */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Signal Threshold (±{threshold})
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 font-medium">
              <span>10</span>
              <span className="text-blue-600 font-bold">30</span>
              <span>50</span>
            </div>
            <p className="text-xs text-gray-500">
              Defines the boundary between neutral and strong demand/supply zones
            </p>
          </div>
        </div>
      </div>

      {/* Historical Data Banner */}
      {isViewingHistorical && viewedData && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-800">
              Viewing Historical Data: {new Date(viewedData.date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <button
            onClick={() => setSelectedPeriodIndex(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Latest
          </button>
        </div>
      )}

      {/* KPIs - Compact row at top */}
      <div className="mb-3">
        <KPIDisplay data={marketData} upToIndex={selectedPeriodIndex} />
      </div>

      {/* Diagram and Signal/Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-3 mb-3">
        <HamiltonDiagram
          currentPosition={signal?.position || null}
          demand={signal?.demand}
          supply={signal?.supply}
          threshold={threshold}
        />
        <div className="flex flex-col gap-1.5" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flexShrink: 0 }}>
            <SignalDisplay signal={signal} />
          </div>
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DataTable 
              data={marketData} 
              selectedIndex={selectedPeriodIndex}
              onRowClick={handlePeriodSelect}
              threshold={threshold}
            />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <CombinedCharts data={marketData} />
    </>
  );
}
