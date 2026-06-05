'use client';

import React from 'react';
import type { DeviceType } from './types';

interface Props {
  deviceType: DeviceType;
  x: number;
  y: number;
  label?: string;
  visible: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const DEVICE_COLORS: Partial<Record<DeviceType, string>> = {
  temp_sensor: '#3b82f6',
  humidity_sensor: '#06b6d4',
  pressure_sensor: '#8b5cf6',
  dp_sensor: '#a855f7',
  flow_sensor: '#0ea5e9',
  co2_sensor: '#10b981',
  supply_fan: '#f59e0b',
  return_fan: '#f97316',
  exhaust_fan: '#ef4444',
  cooling_coil: '#0ea5e9',
  heating_coil: '#ef4444',
  chw_valve: '#3b82f6',
  hw_valve: '#ef4444',
  vfd: '#f59e0b',
  pump: '#64748b',
  controller: '#1d4ed8',
  vav_controller: '#2563eb',
};

const DEVICE_SYMBOLS: Partial<Record<DeviceType, React.ReactNode>> = {
  temp_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">T</text>
    </g>
  ),
  humidity_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">H</text>
    </g>
  ),
  pressure_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">P</text>
    </g>
  ),
  dp_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">ΔP</text>
    </g>
  ),
  flow_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">F</text>
    </g>
  ),
  co2_sensor: (
    <g>
      <circle cx="0" cy="0" r="7" />
      <text x="0" y="4" textAnchor="middle" fontSize="5" fill="white" fontWeight="bold">CO₂</text>
    </g>
  ),
  supply_fan: (
    <g>
      <polygon points="0,-9 8,6 -8,6" />
      <circle cx="0" cy="0" r="4" fill="white" opacity="0.3" />
    </g>
  ),
  vfd: (
    <g>
      <rect x="-8" y="-8" width="16" height="16" rx="2" />
      <text x="0" y="4" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">VFD</text>
    </g>
  ),
  controller: (
    <g>
      <rect x="-9" y="-9" width="18" height="18" rx="3" />
      <text x="0" y="4" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">CTL</text>
    </g>
  ),
};

function DefaultSymbol({ deviceType }: { deviceType: DeviceType }) {
  const initial = deviceType.replace(/_/g, ' ').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
  return (
    <g>
      <rect x="-8" y="-8" width="16" height="16" rx="2" />
      <text x="0" y="4" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">{initial}</text>
    </g>
  );
}

export function DeviceMarker({ deviceType, x, y, label, visible, selected, onClick }: Props) {
  const color = DEVICE_COLORS[deviceType] ?? '#64748b';
  const symbol = DEVICE_SYMBOLS[deviceType] ?? <DefaultSymbol deviceType={deviceType} />;

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <g fill={color} stroke={selected ? '#fbbf24' : 'white'}
        strokeWidth={selected ? 2.5 : 1.5}>
        {symbol}
      </g>
      {label && (
        <text
          y={16}
          textAnchor="middle"
          fontSize="9"
          fill="#1e293b"
          stroke="white"
          strokeWidth="3"
          paintOrder="stroke"
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}
