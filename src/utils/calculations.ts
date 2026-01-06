import { OHLCVData, MarketData, CalculationMethod } from './types';

export function calculateForces(
  data: OHLCVData[],
  method: CalculationMethod
): MarketData[] {
  switch (method) {
    case 'A':
      return calculateMethodA(data);
    case 'B':
      return calculateMethodB(data);
    case 'C':
      return calculateMethodC(data);
    case 'D':
      return calculateMethodD(data);
    default:
      return calculateMethodB(data);
  }
}

// Method A: Money Flow Index (MFI) Based
// Uses both price and volume to measure buying/selling pressure
// More responsive than simple volume ratios
function calculateMethodA(data: OHLCVData[]): MarketData[] {
  const period = 14;
  const typicalPrices: number[] = [];
  const rawMoneyFlows: number[] = [];
  
  // Calculate typical price and raw money flow for each bar
  data.forEach((item, index) => {
    const typicalPrice = (item.high + item.low + item.close) / 3;
    typicalPrices.push(typicalPrice);
    
    const prevTypicalPrice = index > 0 ? typicalPrices[index - 1] : typicalPrice;
    const rawMF = typicalPrice * item.volume;
    
    // Positive if typical price increased, negative if decreased
    rawMoneyFlows.push(typicalPrice >= prevTypicalPrice ? rawMF : -rawMF);
  });

  return data.map((item, index) => {
    if (index < period) {
      return { ...item, demand: 0, supply: 0 };
    }

    // Sum positive and negative money flows over period
    let positiveMF = 0;
    let negativeMF = 0;
    
    for (let i = index - period + 1; i <= index; i++) {
      if (rawMoneyFlows[i] > 0) {
        positiveMF += rawMoneyFlows[i];
      } else {
        negativeMF += Math.abs(rawMoneyFlows[i]);
      }
    }

    // Calculate Money Flow Ratio and MFI
    const mfRatio = negativeMF === 0 ? 100 : positiveMF / negativeMF;
    const mfi = 100 - (100 / (1 + mfRatio));
    
    // Convert MFI (0-100) to demand/supply (-100 to +100)
    // MFI > 50 = buying pressure (demand), < 50 = selling pressure (supply)
    const demand = (mfi - 50) * 2; // Range: -100 to +100
    const supply = (50 - mfi) * 2; // Inverse of demand
    
    return {
      ...item,
      demand: clamp(demand, -100, 100),
      supply: clamp(supply, -100, 100),
    };
  });
}

// Method B: Price-Volume Momentum (Improved)
// Uses rolling normalization for better relative comparison
function calculateMethodB(data: OHLCVData[]): MarketData[] {
  const lookback = 20;
  const rawDemands: number[] = [];
  const rawSupplies: number[] = [];
  
  // First pass: calculate raw values
  data.forEach((item, index) => {
    if (index === 0) {
      rawDemands.push(0);
      rawSupplies.push(0);
      return;
    }

    const prev = data[index - 1];
    const priceRange = item.high - item.low;
    
    // Safety check for invalid previous close
    if (prev.close === 0 || isNaN(prev.close)) {
      rawDemands.push(0);
      rawSupplies.push(0);
      return;
    }
    
    const priceChangePercent = ((item.close - prev.close) / prev.close) * 100;

    if (priceRange === 0 || isNaN(priceRange)) {
      rawDemands.push(0);
      rawSupplies.push(0);
      return;
    }

    // Close Location Value (CLV): where close is within the day's range
    const clv = ((item.close - item.low) - (item.high - item.close)) / priceRange;
    
    // Volume-weighted directional pressure (handle 0 volume gracefully)
    const volumeFactor = item.volume > 0 ? Math.log10(item.volume + 1) : 1;
    const momentum = clv * Math.abs(priceChangePercent) * volumeFactor;
    
    // Handle NaN momentum
    if (isNaN(momentum)) {
      rawDemands.push(0);
      rawSupplies.push(0);
      return;
    }
    
    // Split into demand (positive) and supply (negative)
    if (priceChangePercent >= 0) {
      rawDemands.push(momentum);
      rawSupplies.push(-momentum * 0.3); // Some residual selling
    } else {
      rawDemands.push(momentum * 0.3); // Some residual buying
      rawSupplies.push(-momentum);
    }
  });

  // Second pass: normalize using rolling window
  return data.map((item, index) => {
    if (index < lookback) {
      return { ...item, demand: 0, supply: 0 };
    }

    // Get max absolute values in lookback period for normalization
    let maxDemand = 0.001;
    let maxSupply = 0.001;
    
    for (let i = index - lookback + 1; i <= index; i++) {
      maxDemand = Math.max(maxDemand, Math.abs(rawDemands[i]));
      maxSupply = Math.max(maxSupply, Math.abs(rawSupplies[i]));
    }

    const demand = (rawDemands[index] / maxDemand) * 100;
    const supply = (rawSupplies[index] / maxSupply) * 100;

    return {
      ...item,
      demand: clamp(demand, -100, 100),
      supply: clamp(supply, -100, 100),
    };
  });
}

// Method C: RSI-Volume Hybrid
// Combines RSI momentum with volume confirmation
function calculateMethodC(data: OHLCVData[]): MarketData[] {
  const rsiPeriod = 14;
  const volumePeriod = 10;
  
  // Calculate RSI
  const gains: number[] = [];
  const losses: number[] = [];
  
  data.forEach((item, index) => {
    if (index === 0) {
      gains.push(0);
      losses.push(0);
      return;
    }
    const change = item.close - data[index - 1].close;
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  });

  // Calculate average gains and losses
  const avgGains: number[] = [];
  const avgLosses: number[] = [];
  
  data.forEach((_, index) => {
    if (index < rsiPeriod) {
      avgGains.push(0);
      avgLosses.push(0);
      return;
    }
    
    if (index === rsiPeriod) {
      // First average is SMA
      let sumGain = 0, sumLoss = 0;
      for (let i = 1; i <= rsiPeriod; i++) {
        sumGain += gains[i];
        sumLoss += losses[i];
      }
      avgGains.push(sumGain / rsiPeriod);
      avgLosses.push(sumLoss / rsiPeriod);
    } else {
      // Subsequent averages use smoothing
      avgGains.push((avgGains[index - 1] * (rsiPeriod - 1) + gains[index]) / rsiPeriod);
      avgLosses.push((avgLosses[index - 1] * (rsiPeriod - 1) + losses[index]) / rsiPeriod);
    }
  });

  // Calculate volume ratio (current vs average)
  const volumeRatios: number[] = [];
  data.forEach((item, index) => {
    if (index < volumePeriod) {
      volumeRatios.push(1);
      return;
    }
    let sumVolume = 0;
    for (let i = index - volumePeriod; i < index; i++) {
      sumVolume += data[i].volume;
    }
    const avgVolume = sumVolume / volumePeriod;
    volumeRatios.push(avgVolume > 0 ? item.volume / avgVolume : 1);
  });

  return data.map((item, index) => {
    if (index < rsiPeriod) {
      return { ...item, demand: 0, supply: 0 };
    }

    // Calculate RSI
    const rs = avgLosses[index] === 0 ? 100 : avgGains[index] / avgLosses[index];
    const rsi = 100 - (100 / (1 + rs));
    
    // Volume confirmation factor (1.0 to 2.0)
    const volumeConfirm = Math.min(2, Math.max(0.5, volumeRatios[index]));
    
    // Convert RSI to demand/supply with volume weighting
    // RSI 70+ = strong demand, RSI 30- = strong supply
    const rsiCentered = rsi - 50; // -50 to +50
    
    let demand: number, supply: number;
    
    if (rsiCentered >= 0) {
      // Bullish: demand is positive, supply is negative (retreating)
      demand = (rsiCentered / 50) * 100 * volumeConfirm;
      supply = -(rsiCentered / 50) * 50; // Supply retreats at half strength
    } else {
      // Bearish: supply is positive (pressure), demand is negative
      supply = (-rsiCentered / 50) * 100 * volumeConfirm;
      demand = (rsiCentered / 50) * 50; // Demand retreats at half strength
    }

    return {
      ...item,
      demand: clamp(demand, -100, 100),
      supply: clamp(supply, -100, 100),
    };
  });
}

// Method D: Chaikin Money Flow (CMF) Based
// Standard institutional indicator for accumulation/distribution
function calculateMethodD(data: OHLCVData[]): MarketData[] {
  const period = 21;
  
  // Calculate Money Flow Multiplier and Money Flow Volume for each bar
  const mfVolumes: number[] = [];
  
  data.forEach((item) => {
    const priceRange = item.high - item.low;
    if (priceRange === 0) {
      mfVolumes.push(0);
      return;
    }
    
    // Money Flow Multiplier: ((Close - Low) - (High - Close)) / (High - Low)
    // Range: -1 to +1
    const mfm = ((item.close - item.low) - (item.high - item.close)) / priceRange;
    
    // Money Flow Volume
    mfVolumes.push(mfm * item.volume);
  });

  return data.map((item, index) => {
    if (index < period) {
      return { ...item, demand: 0, supply: 0 };
    }

    // Calculate CMF: sum of MF Volume / sum of Volume over period
    let sumMFV = 0;
    let sumVolume = 0;
    
    for (let i = index - period + 1; i <= index; i++) {
      sumMFV += mfVolumes[i];
      sumVolume += data[i].volume;
    }

    // CMF ranges from -1 to +1
    const cmf = sumVolume === 0 ? 0 : sumMFV / sumVolume;
    
    // Also calculate rate of change in CMF for momentum
    let prevCMF = 0;
    if (index >= period + 5) {
      let prevSumMFV = 0;
      let prevSumVolume = 0;
      for (let i = index - period - 4; i <= index - 5; i++) {
        prevSumMFV += mfVolumes[i];
        prevSumVolume += data[i].volume;
      }
      prevCMF = prevSumVolume === 0 ? 0 : prevSumMFV / prevSumVolume;
    }
    
    const cmfChange = cmf - prevCMF;
    
    // Convert CMF to demand/supply
    // CMF > 0 = accumulation (demand), CMF < 0 = distribution (supply)
    // Add momentum factor for stronger signals
    const momentumBoost = 1 + Math.abs(cmfChange) * 5;
    
    const demand = cmf * 100 * momentumBoost;
    const supply = -cmf * 100 * momentumBoost;

    return {
      ...item,
      demand: clamp(demand, -100, 100),
      supply: clamp(supply, -100, 100),
    };
  });
}

// Helper function to clamp values to a range
function clamp(value: number, min: number, max: number): number {
  // Handle NaN - return 0
  if (isNaN(value) || !isFinite(value)) {
    return 0;
  }
  return Math.max(min, Math.min(max, value));
}
