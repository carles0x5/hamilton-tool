import { MarketSymbol } from '../utils/types';
import { TrendingUp, Coins, Globe, BarChart3 } from 'lucide-react';

const PREDEFINED_SYMBOLS: MarketSymbol[] = [
  // US Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'stocks' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stocks' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stocks' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', category: 'stocks' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', category: 'stocks' },
  // Indices
  { symbol: '^GSPC', name: 'S&P 500 Index', category: 'indices' },
  { symbol: '^IXIC', name: 'NASDAQ Composite', category: 'indices' },
  { symbol: '^DJI', name: 'Dow Jones Industrial Average', category: 'indices' },
  { symbol: '^RUT', name: 'Russell 2000', category: 'indices' },
  { symbol: '^VIX', name: 'CBOE Volatility Index', category: 'indices' },
  { symbol: '^TNX', name: '10-Year Treasury Yield', category: 'indices' },
  // Crypto
  { symbol: 'BTCUSD', name: 'Bitcoin', category: 'crypto' },
  { symbol: 'ETHUSD', name: 'Ethereum', category: 'crypto' },
  // Forex
  { symbol: 'EURUSD', name: 'Euro/US Dollar', category: 'forex' },
  { symbol: 'GBPUSD', name: 'British Pound/US Dollar', category: 'forex' },
  { symbol: 'USDJPY', name: 'US Dollar/Japanese Yen', category: 'forex' },
];

interface MarketSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  selectedCategory: MarketSymbol['category'];
  onCategoryChange: (category: MarketSymbol['category']) => void;
}

const categoryIcons = {
  stocks: TrendingUp,
  crypto: Coins,
  forex: Globe,
  indices: BarChart3,
};

export default function MarketSelector({
  selectedSymbol,
  onSymbolChange,
  selectedCategory,
  onCategoryChange,
}: MarketSelectorProps) {
  const symbolsByCategory = PREDEFINED_SYMBOLS.filter(
    (s) => s.category === selectedCategory
  );

  const CategoryIcon = categoryIcons[selectedCategory];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Market Category
          </label>
          <div className="relative">
            <CategoryIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                const category = e.target.value as MarketSymbol['category'];
                onCategoryChange(category);
                const firstSymbol = PREDEFINED_SYMBOLS.find((s) => s.category === category);
                if (firstSymbol) {
                  onSymbolChange(firstSymbol.symbol);
                }
              }}
              className="select-modern"
              style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            >
              <option value="indices">Indices</option>
              <option value="stocks">US Stocks</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Symbol
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            className="select-modern"
          >
            {symbolsByCategory.map((symbol) => (
              <option key={symbol.symbol} value={symbol.symbol}>
                {symbol.symbol} - {symbol.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Or enter custom symbol
        </label>
        <input
          type="text"
          value={selectedSymbol}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          placeholder="Enter symbol"
          className="input-modern"
        />
      </div>
    </div>
  );
}
