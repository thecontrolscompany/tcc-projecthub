'use client';

import React, { useMemo, useState } from 'react';
import ggtSymbolCatalog from '@/data/projecthub/ggt_symbol_catalog.json';

type GgtSymbolCatalog = {
  symbols: Array<{
    symbol_id: string;
    source_xaml: string[];
    equipment_device_type: string;
    output_svg_path: string;
    ontology_ids: string[];
    notes?: string;
  }>;
};

type Placement = {
  symbolId: string;
  primaryOntologyId: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tagX: number;
  tagY: number;
  description: string;
};

const catalog = ggtSymbolCatalog as GgtSymbolCatalog;

const placements: Placement[] = [
  { symbolId: 'damper', primaryOntologyId: 'mixed_air_damper_position', label: 'Mixed Air Damper', x: 150, y: 156, w: 58, h: 58, tagX: 179, tagY: 126, description: 'Damper position' },
  { symbolId: 'filter', primaryOntologyId: 'prefilter_status', label: 'Pre-Filter', x: 250, y: 156, w: 58, h: 58, tagX: 279, tagY: 126, description: 'Filter status' },
  { symbolId: 'temp_sensor', primaryOntologyId: 'mixed_air_temperature', label: 'Mixed Air Temp', x: 356, y: 156, w: 58, h: 58, tagX: 385, tagY: 126, description: 'Mixed air temperature' },
  { symbolId: 'heating_coil', primaryOntologyId: 'heating_output', label: 'Heating Coil', x: 458, y: 154, w: 66, h: 66, tagX: 491, tagY: 122, description: 'Heating output' },
  { symbolId: 'cooling_coil', primaryOntologyId: 'cooling_output', label: 'Cooling Coil', x: 570, y: 154, w: 66, h: 66, tagX: 603, tagY: 122, description: 'Cooling output' },
  { symbolId: 'supply_fan', primaryOntologyId: 'supply_fan_status', label: 'Supply Fan', x: 684, y: 148, w: 74, h: 74, tagX: 721, tagY: 114, description: 'Supply fan status' },
  { symbolId: 'airflow_sensor', primaryOntologyId: 'supply_air_flow', label: 'Airflow', x: 800, y: 154, w: 58, h: 58, tagX: 829, tagY: 124, description: 'Supply airflow' },
  { symbolId: 'pressure_sensor', primaryOntologyId: 'cold_deck_pressure', label: 'Pressure', x: 890, y: 154, w: 58, h: 58, tagX: 919, tagY: 124, description: 'Pressure reading' },
  { symbolId: 'humidity_sensor', primaryOntologyId: 'outdoor_air_humidity', label: 'OA Humidity', x: 120, y: 308, w: 58, h: 58, tagX: 149, tagY: 278, description: 'Outdoor humidity' },
  { symbolId: 'temp_sensor', primaryOntologyId: 'outdoor_air_temperature', label: 'OA Temp', x: 212, y: 308, w: 58, h: 58, tagX: 241, tagY: 278, description: 'Outdoor temperature' },
  { symbolId: 'controller_panel', primaryOntologyId: 'application_mode', label: 'Controller', x: 916, y: 320, w: 118, h: 88, tagX: 975, tagY: 292, description: 'Controller / panel' },
  { symbolId: 'vfd_panel', primaryOntologyId: 'vfd_fault', label: 'VFD', x: 684, y: 316, w: 90, h: 72, tagX: 729, tagY: 288, description: 'Drive / fault' }
];

const symbolById = new Map(catalog.symbols.map((symbol) => [symbol.symbol_id, symbol]));

export function GgtMixedAirPoc() {
  const [selectedOntologyIds, setSelectedOntologyIds] = useState<string[]>(
    placements.map((placement) => placement.primaryOntologyId)
  );

  const selectedSet = useMemo(() => new Set(selectedOntologyIds), [selectedOntologyIds]);

  const toggle = (ontologyId: string) => {
    setSelectedOntologyIds((current) =>
      current.includes(ontologyId) ? current.filter((id) => id !== ontologyId) : [...current, ontologyId]
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{
        width: 280,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
          GGT Mixed Air POC
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          Symbol-first assembly using GGT/XAML-derived SVG assets.
        </div>
        <div style={{
          padding: '8px 10px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          fontSize: 12,
          color: '#334155',
          marginBottom: 10,
        }}>
          Selected ontology IDs: <strong>{selectedOntologyIds.length}</strong>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {placements.map((placement) => {
            const symbol = symbolById.get(placement.symbolId);
            const isOn = selectedSet.has(placement.primaryOntologyId);
            return (
              <label
                key={placement.primaryOntologyId}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid ' + (isOn ? '#bfdbfe' : '#e2e8f0'),
                  background: isOn ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(placement.primaryOntologyId)}
                  style={{ marginTop: 3 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {placement.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#2563eb', wordBreak: 'break-word' }}>
                    {placement.primaryOntologyId}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {symbol?.equipment_device_type ?? 'unknown'}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 640 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
          Clean ProjectHub duct schematic assembled from reusable GGT symbols. Checkboxes hide or mute the matched
          devices and associated point markers.
        </div>
        <svg
          viewBox="0 0 1120 520"
          width="100%"
          style={{
            display: 'block',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            maxHeight: 720,
          }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="GGT mixed air AHU proof of concept"
        >
          <defs>
            <linearGradient id="ductGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <filter id="selectedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.75" />
            </filter>
            <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#334155" />
            </marker>
          </defs>

          <rect x="0" y="0" width="1120" height="520" fill="url(#ductGrad)" opacity="0.12" />
          <path d="M70 240h830" stroke="#475569" strokeWidth="20" strokeLinecap="round" opacity="0.16" />
          <path d="M70 240h830" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
          <path d="M150 240l0 -48" stroke="#0f172a" strokeWidth="2.5" opacity="0.5" />
          <path d="M250 240l0 -80" stroke="#0f172a" strokeWidth="2.5" opacity="0.5" />
          <path d="M410 240l0 92" stroke="#0f172a" strokeWidth="2.5" opacity="0.5" />
          <path d="M730 240l0 74" stroke="#0f172a" strokeWidth="2.5" opacity="0.5" />
          <path d="M1000 240l0 74" stroke="#0f172a" strokeWidth="2.5" opacity="0.5" />

          <text x="76" y="224" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#334155">
            Mixed Air AHU
          </text>
          <text x="854" y="224" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#334155">
            Supply
          </text>

          {placements.map((placement) => {
            const symbol = symbolById.get(placement.symbolId);
            const isOn = selectedSet.has(placement.primaryOntologyId);
            if (!symbol) return null;
            return (
              <g key={placement.primaryOntologyId}>
                <image
                  href={symbol.output_svg_path}
                  x={placement.x}
                  y={placement.y}
                  width={placement.w}
                  height={placement.h}
                  opacity={isOn ? 1 : 0.16}
                  filter={isOn ? 'url(#selectedGlow)' : undefined}
                  onClick={() => toggle(placement.primaryOntologyId)}
                  style={{ cursor: 'pointer' }}
                />
                {isOn && (
                  <>
                    <rect
                      x={placement.tagX - 2}
                      y={placement.tagY - 16}
                      width={Math.max(placement.label.length * 6.4, 86)}
                      height={20}
                      rx={6}
                      fill="#ffffff"
                      stroke="#60a5fa"
                      strokeWidth="1.5"
                    />
                    <text
                      x={placement.tagX + 2}
                      y={placement.tagY}
                      fontFamily="Arial, sans-serif"
                      fontSize="11"
                      fontWeight="700"
                      fill="#1d4ed8"
                    >
                      {placement.label}
                    </text>
                  </>
                )}
                {!isOn && (
                  <text
                    x={placement.tagX}
                    y={placement.tagY}
                    fontFamily="Arial, sans-serif"
                    fontSize="10"
                    fill="#94a3b8"
                    opacity="0.5"
                  >
                    {placement.description}
                  </text>
                )}
              </g>
            );
          })}

          <path
            d="M70 120h170"
            stroke="#0f172a"
            strokeWidth="2"
            strokeDasharray="7 6"
            markerEnd="url(#arrowHead)"
            opacity="0.65"
          />
          <path
            d="M70 360h170"
            stroke="#0f172a"
            strokeWidth="2"
            strokeDasharray="7 6"
            markerEnd="url(#arrowHead)"
            opacity="0.35"
          />
        </svg>
      </div>
    </div>
  );
}
