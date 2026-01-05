import { useState } from 'react';
import { DiagramPosition } from '../utils/types';
import { getPositionName, DEFAULT_THRESHOLD } from '../utils/diagramLogic';

interface HamiltonDiagramProps {
  currentPosition: DiagramPosition | null;
  demand?: number;
  supply?: number;
  threshold?: number;
}

const CHART_SIZE = 420;
const MARGIN = 48;

// Zone colors with clear good-to-bad transition
// Good (Green) → Neutral (Blue/Gray) → Bad (Orange/Red)
const ZONE_COLORS = {
  [DiagramPosition.FREE_RISE]: '#059669',      // Dark green - Best (strong bullish)
  [DiagramPosition.WEAK_BULL]: '#10b981',      // Green - Good (bullish)
  [DiagramPosition.CONSOLIDATION]: '#3b82f6',  // Blue - Accumulation (positive)
  [DiagramPosition.CHAOS]: '#6b7280',          // Gray - Neutral (uncertain)
  [DiagramPosition.DISTRIBUTION]: '#f59e0b',    // Amber - Warning (distribution)
  [DiagramPosition.BEAR_RALLY]: '#f97316',     // Orange - Caution (confusing)
  [DiagramPosition.BULL_TRAP]: '#ef4444',       // Red - Bad (bearish trap)
  [DiagramPosition.WEAK_BEAR]: '#dc2626',       // Dark red - Bad (bearish)
  [DiagramPosition.FREE_FALL]: '#991b1b',       // Very dark red - Worst (strong bearish)
};

// Convert value to pixel coordinates
function valueToPixel(value: number, min: number, max: number, size: number): number {
  return ((value - min) / (max - min)) * size;
}

export default function HamiltonDiagram({ currentPosition, demand = 0, supply = 0, threshold = DEFAULT_THRESHOLD }: HamiltonDiagramProps) {
  const [highlightedZone, setHighlightedZone] = useState<DiagramPosition | null>(null);
  
  const chartWidth = CHART_SIZE;
  const chartHeight = CHART_SIZE;
  const plotWidth = chartWidth - 2 * MARGIN;
  const plotHeight = chartHeight - 2 * MARGIN;

  // Define the 9 zones with their boundaries and colors (using dynamic threshold)
  const ZONES = [
    { name: 'Free Rise', position: DiagramPosition.FREE_RISE, color: ZONE_COLORS[DiagramPosition.FREE_RISE], xMin: -100, xMax: -threshold, yMin: threshold, yMax: 100 },
    { name: 'Weak Bull', position: DiagramPosition.WEAK_BULL, color: ZONE_COLORS[DiagramPosition.WEAK_BULL], xMin: -threshold, xMax: threshold, yMin: threshold, yMax: 100 },
    { name: 'Bear Rally', position: DiagramPosition.BEAR_RALLY, color: ZONE_COLORS[DiagramPosition.BEAR_RALLY], xMin: threshold, xMax: 100, yMin: threshold, yMax: 100 },
    { name: 'Consolidation', position: DiagramPosition.CONSOLIDATION, color: ZONE_COLORS[DiagramPosition.CONSOLIDATION], xMin: -100, xMax: -threshold, yMin: -threshold, yMax: threshold },
    { name: 'Chaos', position: DiagramPosition.CHAOS, color: ZONE_COLORS[DiagramPosition.CHAOS], xMin: -threshold, xMax: threshold, yMin: -threshold, yMax: threshold },
    { name: 'Distribution', position: DiagramPosition.DISTRIBUTION, color: ZONE_COLORS[DiagramPosition.DISTRIBUTION], xMin: threshold, xMax: 100, yMin: -threshold, yMax: threshold },
    { name: 'Bull Trap', position: DiagramPosition.BULL_TRAP, color: ZONE_COLORS[DiagramPosition.BULL_TRAP], xMin: -100, xMax: -threshold, yMin: -100, yMax: -threshold },
    { name: 'Weak Bear', position: DiagramPosition.WEAK_BEAR, color: ZONE_COLORS[DiagramPosition.WEAK_BEAR], xMin: -threshold, xMax: threshold, yMin: -100, yMax: -threshold },
    { name: 'Free Fall', position: DiagramPosition.FREE_FALL, color: ZONE_COLORS[DiagramPosition.FREE_FALL], xMin: threshold, xMax: 100, yMin: -100, yMax: -threshold },
  ];

  // Convert supply/demand to pixel coordinates
  const supplyX = MARGIN + valueToPixel(supply, -100, 100, plotWidth);
  const demandY = MARGIN + plotHeight - valueToPixel(demand, -100, 100, plotHeight);

  // Calculate exact pixel positions for threshold lines to ensure zones align perfectly
  const xMin100 = MARGIN;
  const xThresholdNeg = MARGIN + valueToPixel(-threshold, -100, 100, plotWidth);
  const xThresholdPos = MARGIN + valueToPixel(threshold, -100, 100, plotWidth);
  const xMax100 = MARGIN + plotWidth;
  
  const yMin100 = MARGIN + plotHeight;
  const yThresholdNeg = MARGIN + plotHeight - valueToPixel(-threshold, -100, 100, plotHeight);
  const yThresholdPos = MARGIN + plotHeight - valueToPixel(threshold, -100, 100, plotHeight);
  const yMax100 = MARGIN;
  
  // Draw zone rectangles with exact boundaries that match grid lines
  const zoneRects = ZONES.map(zone => {
    let x, y, width, height;
    
    // Calculate X position and width based on zone boundaries
    if (zone.xMin === -100 && zone.xMax === -threshold) {
      // Left column: -100 to -threshold
      x = xMin100;
      width = xThresholdNeg - xMin100;
    } else if (zone.xMin === -threshold && zone.xMax === threshold) {
      // Middle column: -threshold to threshold
      x = xThresholdNeg;
      width = xThresholdPos - xThresholdNeg;
    } else if (zone.xMin === threshold && zone.xMax === 100) {
      // Right column: threshold to 100
      x = xThresholdPos;
      width = xMax100 - xThresholdPos;
    } else {
      // Fallback (shouldn't happen)
      x = MARGIN + valueToPixel(zone.xMin, -100, 100, plotWidth);
      width = valueToPixel(zone.xMax - zone.xMin, -100, 100, plotWidth);
    }
    
    // Calculate Y position and height based on zone boundaries (SVG Y increases downward)
    if (zone.yMin === threshold && zone.yMax === 100) {
      // Top row: threshold to 100
      y = yMax100;
      height = yThresholdPos - yMax100;
    } else if (zone.yMin === -threshold && zone.yMax === threshold) {
      // Middle row: -threshold to threshold
      y = yThresholdPos;
      height = yThresholdNeg - yThresholdPos;
    } else if (zone.yMin === -100 && zone.yMax === -threshold) {
      // Bottom row: -100 to -threshold
      y = yThresholdNeg;
      height = yMin100 - yThresholdNeg;
    } else {
      // Fallback (shouldn't happen)
      y = MARGIN + plotHeight - valueToPixel(zone.yMax, -100, 100, plotHeight);
      height = valueToPixel(zone.yMax - zone.yMin, -100, 100, plotHeight);
    }
    
    // Ensure zones don't exceed plot boundaries
    x = Math.max(MARGIN, Math.min(x, MARGIN + plotWidth));
    y = Math.max(MARGIN, Math.min(y, MARGIN + plotHeight));
    width = Math.min(width, MARGIN + plotWidth - x);
    height = Math.min(height, MARGIN + plotHeight - y);
    
    return {
      ...zone,
      x,
      y,
      width,
      height,
    };
  });

  // Grid lines (using dynamic threshold)
  const gridLines = [
    { type: 'vertical', value: -threshold, label: `S=-${threshold}` },
    { type: 'vertical', value: 0, label: 'S=0' },
    { type: 'vertical', value: threshold, label: `S=${threshold}` },
    { type: 'horizontal', value: -threshold, label: `D=-${threshold}` },
    { type: 'horizontal', value: 0, label: 'D=0' },
    { type: 'horizontal', value: threshold, label: `D=${threshold}` },
  ];

  // Unique clip path ID
  const clipPathId = `hamilton-clip-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full animate-fade-in">
      <div className="card p-3">
        <h3 className="text-base font-bold mb-2 text-center gradient-text">
          Hamilton Diagram
        </h3>
        
        {/* Compact Legend */}
        <div className="mb-2 flex flex-wrap justify-center gap-1 text-xs">
          {ZONES.map((zone) => {
            const isHighlighted = highlightedZone === zone.position;
            return (
              <div 
                key={zone.name} 
                onClick={() => setHighlightedZone(isHighlighted ? null : zone.position)}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded border cursor-pointer transition-all ${
                  isHighlighted 
                    ? 'bg-blue-100 border-blue-400 shadow-md scale-105' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div 
                  className="w-1.5 h-1.5 rounded-sm" 
                  style={{ backgroundColor: zone.color }}
                ></div>
                <span className={`text-[10px] font-medium ${
                  isHighlighted ? 'text-blue-900 font-bold' : 'text-gray-700'
                }`}>{zone.name}</span>
              </div>
            );
          })}
        </div>

        {/* Graph Container */}
        <div className="relative bg-white p-2 rounded border border-gray-200">
          <svg 
            width={chartWidth} 
            height={chartHeight} 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            style={{ maxWidth: '100%' }}
          >
            <defs>
              {/* Clip path to strictly contain zones */}
              <clipPath id={clipPathId}>
                <rect x={MARGIN} y={MARGIN} width={plotWidth} height={plotHeight} rx="0" />
              </clipPath>
              {/* Gradient definitions for zones */}
              {ZONES.map((zone, index) => {
                const zoneId = zone.name.replace(/\s+/g, '-');
                return (
                  <linearGradient key={`gradient-${index}`} id={`gradient-${zoneId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={zone.color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={zone.color} stopOpacity="0.3" />
                  </linearGradient>
                );
              })}
              {/* Glow filter for current point */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Zone backgrounds - STRICTLY clipped and drawn before grid lines */}
            <g clipPath={`url(#${clipPathId})`}>
              {zoneRects.map((zone, index) => {
                const zoneId = zone.name.replace(/\s+/g, '-');
                const isHighlighted = highlightedZone === zone.position;
                return (
                  <rect
                    key={`zone-${index}`}
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill={`url(#gradient-${zoneId})`}
                    stroke={isHighlighted ? zone.color : 'none'}
                    strokeWidth={isHighlighted ? 3 : 0}
                    strokeOpacity={isHighlighted ? 0.8 : 0}
                    opacity={isHighlighted ? 1 : 1}
                    style={{
                      filter: isHighlighted ? 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' : 'none',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  />
                );
              })}
            </g>

            {/* Grid lines (no labels - axes have tick marks) */}
            {gridLines.map((line, index) => {
              if (line.type === 'vertical') {
                const x = MARGIN + valueToPixel(line.value, -100, 100, plotWidth);
                const isZero = line.value === 0;
                return (
                  <line
                    key={`grid-${index}`}
                    x1={x}
                    y1={MARGIN}
                    x2={x}
                    y2={MARGIN + plotHeight}
                    stroke={isZero ? '#94a3b8' : '#64748b'}
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? '2 2' : '4 2'}
                    opacity={isZero ? 0.6 : 0.5}
                  />
                );
              } else {
                const y = MARGIN + plotHeight - valueToPixel(line.value, -100, 100, plotHeight);
                const isZero = line.value === 0;
                return (
                  <line
                    key={`grid-${index}`}
                    x1={MARGIN}
                    y1={y}
                    x2={MARGIN + plotWidth}
                    y2={y}
                    stroke={isZero ? '#94a3b8' : '#64748b'}
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? '2 2' : '4 2'}
                    opacity={isZero ? 0.6 : 0.5}
                  />
                );
              }
            })}

            {/* Axes */}
            <line
              x1={MARGIN}
              y1={MARGIN + plotHeight}
              x2={MARGIN + plotWidth}
              y2={MARGIN + plotHeight}
              stroke="#1e293b"
              strokeWidth={2}
            />
            <line
              x1={MARGIN}
              y1={MARGIN}
              x2={MARGIN}
              y2={MARGIN + plotHeight}
              stroke="#1e293b"
              strokeWidth={2}
            />

            {/* Axis labels */}
            <text
              x={MARGIN + plotWidth / 2}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="11"
              fontWeight="700"
            >
              Supply Force (%)
            </text>
            <text
              x={12}
              y={MARGIN + plotHeight / 2}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="11"
              fontWeight="700"
              transform={`rotate(-90, 12, ${MARGIN + plotHeight / 2})`}
            >
              Demand Force (%)
            </text>

            {/* Axis ticks and labels */}
            {[-100, -50, -30, 0, 30, 50, 100].map((tick) => {
              const x = MARGIN + valueToPixel(tick, -100, 100, plotWidth);
              const y = MARGIN + plotHeight - valueToPixel(tick, -100, 100, plotHeight);
              const isThreshold = Math.abs(tick) === threshold;
              return (
                <g key={`tick-${tick}`}>
                  {/* X-axis ticks */}
                  <line
                    x1={x}
                    y1={MARGIN + plotHeight}
                    x2={x}
                    y2={MARGIN + plotHeight + (isThreshold ? 4 : 2)}
                    stroke="#1e293b"
                    strokeWidth={isThreshold ? 1.5 : 1}
                  />
                  <text
                    x={x}
                    y={MARGIN + plotHeight + 15}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="8"
                    fontWeight={isThreshold ? "600" : "500"}
                    className="tabular-nums"
                  >
                    {tick}
                  </text>
                  {/* Y-axis ticks */}
                  <line
                    x1={MARGIN}
                    y1={y}
                    x2={MARGIN - (isThreshold ? 4 : 2)}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth={isThreshold ? 1.5 : 1}
                  />
                  <text
                    x={MARGIN - 6}
                    y={y + 2}
                    textAnchor="end"
                    fill="#475569"
                    fontSize="8"
                    fontWeight={isThreshold ? "600" : "500"}
                    className="tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Current position point */}
            {demand !== undefined && supply !== undefined && (
              <g>
                {/* Outer glow ring */}
                <circle
                  cx={supplyX}
                  cy={demandY}
                  r={10}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  opacity={0.4}
                  filter="url(#glow)"
                />
                {/* Main point */}
                <circle
                  cx={supplyX}
                  cy={demandY}
                  r={6}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  filter="url(#glow)"
                />
                {/* Inner highlight */}
                <circle
                  cx={supplyX - 1}
                  cy={demandY - 1}
                  r={1.5}
                  fill="#ffffff"
                  opacity={0.7}
                />
                {/* Label background */}
                <rect
                  x={supplyX - 50}
                  y={demandY - 42}
                  width={100}
                  height={36}
                  rx={4}
                  fill="#ffffff"
                  fillOpacity={0.95}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  filter="url(#glow)"
                />
                {/* Position name */}
                <text
                  x={supplyX}
                  y={demandY - 26}
                  textAnchor="middle"
                  fill="#1e40af"
                  fontSize="10"
                  fontWeight="700"
                >
                  {getPositionName(currentPosition || DiagramPosition.CHAOS)}
                </text>
                {/* Coordinates */}
                <text
                  x={supplyX}
                  y={demandY - 12}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8"
                  fontWeight="600"
                  className="tabular-nums"
                >
                  ({supply.toFixed(1)}%, {demand.toFixed(1)}%)
                </text>
              </g>
            )}
          </svg>

          {/* Compact info panel */}
          {currentPosition && demand !== undefined && supply !== undefined && (
            <div className="mt-2 p-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
              <div className="text-center">
                <div className="font-bold text-blue-900 text-xs mb-0.5">
                  {getPositionName(currentPosition)}
                </div>
                <div className="text-[10px] text-blue-700 font-medium tabular-nums">
                  Supply: {supply.toFixed(1)}% | Demand: {demand.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
