import { useState, useEffect } from 'react';
import { MarketSymbol, Timeframe, OHLCVData } from './utils/types';
import { fetchMarketData } from './services/marketData';
import { getCachedData, setCachedData } from './services/cacheService';
import MarketSelector from './components/MarketSelector';
import TimeframeSelector from './components/TimeframeSelector';
import { AnalysisTab, StrategyTestTab, ComparisonTab, OptimizationTab } from './components/tabs';
import { 
  BarChart3, Play, Loader2, AlertCircle, Info,
  LineChart, FlaskConical, GitCompare, Search, AlertTriangle
} from 'lucide-react';

type Tab = 'analysis' | 'test' | 'compare' | 'optimize';

const TABS: { id: Tab; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { id: 'analysis', label: 'Hamilton Analysis', icon: LineChart, description: 'Hamilton Diagram signals' },
  { id: 'test', label: 'Strategy Test', icon: FlaskConical, description: 'Test single strategy' },
  { id: 'compare', label: 'Comparison', icon: GitCompare, description: 'Compare strategies' },
  { id: 'optimize', label: 'Optimization', icon: Search, description: 'Find optimal parameters' },
];

function App() {
  // Data fetching state
  const [selectedSymbol, setSelectedSymbol] = useState<string>('^GSPC');
  const [selectedCategory, setSelectedCategory] = useState<MarketSymbol['category']>('indices');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('daily');
  
  // Raw OHLCV data (without Hamilton forces)
  const [rawData, setRawData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState<boolean>(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('analysis');

  const handleFetchData = async () => {
    if (!selectedSymbol.trim()) {
      setError('Please select or enter a symbol');
      return;
    }

    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    try {
      // Check cache first for raw OHLCV data
      const cached = await getCachedData(selectedSymbol, selectedTimeframe, 'A');
      
      let ohlcvData;
      if (cached) {
        ohlcvData = cached;
        setIsUsingCache(true);
        setRawData(ohlcvData);
        setLoading(false);
        
        // Try to refresh in background (don't wait for it)
        fetchMarketData(selectedSymbol, selectedCategory, selectedTimeframe)
          .then(async (freshData) => {
            await setCachedData(selectedSymbol, selectedTimeframe, 'A', freshData);
            setRawData(freshData);
            setIsUsingCache(false);
          })
          .catch(() => {
            // Silently fail - we already have cached data
          });
        return;
      }
      
      // No cache, fetch fresh data
      ohlcvData = await fetchMarketData(selectedSymbol, selectedCategory, selectedTimeframe);
      await setCachedData(selectedSymbol, selectedTimeframe, 'A', ohlcvData);
      setRawData(ohlcvData);
    } catch (err) {
      // If API fails, try to use any cached data (even if stale)
      const cached = await getCachedData(selectedSymbol, selectedTimeframe, 'A');
      if (cached && cached.length > 0) {
        setRawData(cached);
        setIsUsingCache(true);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
        setError(`${errorMessage}. Using cached data instead.`);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
        setError(errorMessage);
        setRawData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cleanup old cache on mount
  useEffect(() => {
    import('./services/cacheService').then(({ cleanupOldCache }) => {
      cleanupOldCache();
    });
  }, []);

  // Data period warning
  const showDataWarning = rawData.length > 0 && rawData.length < 200;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Market Analyzer</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-3 max-w-7xl">
        {/* Data Fetching Controls */}
        <div className="card p-4 mb-3 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Market Selection */}
            <div className="md:col-span-2">
              <MarketSelector
                selectedSymbol={selectedSymbol}
                onSymbolChange={setSelectedSymbol}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </div>
            
            {/* Timeframe */}
            <TimeframeSelector
              selectedTimeframe={selectedTimeframe}
              onTimeframeChange={setSelectedTimeframe}
            />
            
            {/* Fetch Button */}
            <div className="flex items-end">
              <button
                onClick={handleFetchData}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Fetch Data
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {isUsingCache && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Info className="w-4 h-4" />
              <span className="font-medium">Using cached data</span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-semibold mb-1">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        {rawData.length > 0 && !loading && (
          <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={tab.description}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Data Warning */}
        {showDataWarning && activeTab !== 'analysis' && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Limited Data ({rawData.length} periods)</p>
              <p className="text-sm text-amber-700">
                Backtesting and optimization work best with at least 200 periods.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium text-lg">Loading market data...</p>
            <p className="text-gray-500 text-sm mt-2">Fetching data from Yahoo Finance</p>
          </div>
        )}

        {!loading && rawData.length > 0 && (
          <>
            {activeTab === 'analysis' && (
              <AnalysisTab rawData={rawData} />
            )}
            {activeTab === 'test' && (
              <StrategyTestTab data={rawData} symbol={selectedSymbol} />
            )}
            {activeTab === 'compare' && (
              <ComparisonTab data={rawData} symbol={selectedSymbol} />
            )}
            {activeTab === 'optimize' && (
              <OptimizationTab data={rawData} symbol={selectedSymbol} />
            )}
          </>
        )}

        {!loading && rawData.length === 0 && !error && (
          <div className="card p-12 text-center animate-fade-in">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium mb-2">Ready to Analyze</p>
            <p className="text-gray-500">
              Select a market and timeframe, then click "Fetch Data" to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
