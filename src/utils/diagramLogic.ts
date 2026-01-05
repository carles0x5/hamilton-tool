import { DiagramPosition, TradingSignal } from './types';

// Default threshold - can be customized
// Common values: 25, 30, 40, 50
// Lower values = tighter zones, more sensitive
// Higher values = wider zones, less sensitive
export const DEFAULT_THRESHOLD = 30;

export function getThresholds(customThreshold?: number) {
  const threshold = customThreshold ?? DEFAULT_THRESHOLD;
  return {
    STRONG_THRESHOLD: threshold,
    WEAK_THRESHOLD: -threshold,
  };
}

export function mapToPosition(demand: number, supply: number, customThreshold?: number): DiagramPosition {
  const { STRONG_THRESHOLD, WEAK_THRESHOLD } = getThresholds(customThreshold);
  const demandStrong = demand > STRONG_THRESHOLD;
  const demandNeutral = demand >= WEAK_THRESHOLD && demand <= STRONG_THRESHOLD;
  const demandWeak = demand < WEAK_THRESHOLD;

  const supplyStrong = supply > STRONG_THRESHOLD;
  const supplyNeutral = supply >= WEAK_THRESHOLD && supply <= STRONG_THRESHOLD;
  const supplyWeak = supply < WEAK_THRESHOLD;

  // Free Rise ↑↑
  if (demandStrong && supplyWeak) {
    return DiagramPosition.FREE_RISE;
  }

  // Weak Bull ↑→
  if (demandStrong && supplyNeutral) {
    return DiagramPosition.WEAK_BULL;
  }

  // Bear Rally ↑↓
  if (demandStrong && supplyStrong) {
    return DiagramPosition.BEAR_RALLY;
  }

  // Consolidation →↑
  if (demandNeutral && supplyWeak) {
    return DiagramPosition.CONSOLIDATION;
  }

  // Chaos →→
  if (demandNeutral && supplyNeutral) {
    return DiagramPosition.CHAOS;
  }

  // Distribution →↓
  if (demandNeutral && supplyStrong) {
    return DiagramPosition.DISTRIBUTION;
  }

  // Bull Trap ↓↑
  if (demandWeak && supplyWeak) {
    return DiagramPosition.BULL_TRAP;
  }

  // Weak Bear ↓→
  if (demandWeak && supplyNeutral) {
    return DiagramPosition.WEAK_BEAR;
  }

  // Free Fall ↓↓
  if (demandWeak && supplyStrong) {
    return DiagramPosition.FREE_FALL;
  }

  // Default to chaos if somehow none match
  return DiagramPosition.CHAOS;
}

export function generateSignal(position: DiagramPosition): TradingSignal['action'] {
  switch (position) {
    case DiagramPosition.FREE_RISE:
      return 'LONG';
    case DiagramPosition.WEAK_BULL:
      return 'HOLD_LONG';
    case DiagramPosition.BEAR_RALLY:
      return 'EXIT_SHORT';
    case DiagramPosition.CONSOLIDATION:
      return 'ACCUMULATE';
    case DiagramPosition.CHAOS:
      return 'WAIT';
    case DiagramPosition.DISTRIBUTION:
      return 'REDUCE';
    case DiagramPosition.BULL_TRAP:
      return 'EXIT_LONG';
    case DiagramPosition.WEAK_BEAR:
      return 'HOLD_SHORT';
    case DiagramPosition.FREE_FALL:
      return 'SHORT';
    default:
      return 'WAIT';
  }
}

export function getQualityAssessment(demand: number, supply: number): TradingSignal['quality'] {
  const demandAbs = Math.abs(demand);
  const supplyAbs = Math.abs(supply);
  const avgForce = (demandAbs + supplyAbs) / 2;

  // High force with clear direction = Healthy
  if (avgForce > 50 && Math.abs(demand - supply) > 40) {
    return 'Healthy';
  }

  // Very high force but conflicting = Warning
  if (avgForce > 60 && Math.abs(demand - supply) < 20) {
    return 'Warning';
  }

  // Low force = Speculative
  if (avgForce < 30) {
    return 'Speculative';
  }

  // Medium force = Speculative
  return 'Speculative';
}

export function getPositionName(position: DiagramPosition): string {
  const names: Record<DiagramPosition, string> = {
    [DiagramPosition.FREE_RISE]: 'Free Rise ↑↑',
    [DiagramPosition.WEAK_BULL]: 'Weak Bull ↑→',
    [DiagramPosition.BEAR_RALLY]: 'Bear Rally ↑↓',
    [DiagramPosition.CONSOLIDATION]: 'Consolidation →↑',
    [DiagramPosition.CHAOS]: 'Chaos →→',
    [DiagramPosition.DISTRIBUTION]: 'Distribution →↓',
    [DiagramPosition.BULL_TRAP]: 'Bull Trap ↓↑',
    [DiagramPosition.WEAK_BEAR]: 'Weak Bear ↓→',
    [DiagramPosition.FREE_FALL]: 'Free Fall ↓↓',
  };
  return names[position];
}

export function createTradingSignal(
  demand: number,
  supply: number,
  customThreshold?: number
): TradingSignal {
  const position = mapToPosition(demand, supply, customThreshold);
  const action = generateSignal(position);
  const quality = getQualityAssessment(demand, supply);

  return {
    position,
    action,
    demand,
    supply,
    quality,
  };
}

