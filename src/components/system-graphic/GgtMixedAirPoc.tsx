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

type GgtMixedAirPlacement = {
  key: string;
  symbolId: string;
  label: string;
  ontologyIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  tagX: number;
  tagY: number;
  tagAlign?: 'left' | 'center' | 'right';
};

type GgtMixedAirPocProps = {
  selectedOntologyIds?: string[];
  onToggleOntologyId?: (ontologyId: string) => void;
  showControls?: boolean;
  showLegend?: boolean;
  systemKey?: 'mixed_air_single_point_ahu' | 'mixed_air_dual_point_ahu';
  className?: string;
};

const catalog = ggtSymbolCatalog as GgtSymbolCatalog;
const symbolById = new Map(catalog.symbols.map((symbol) => [symbol.symbol_id, symbol]));

const placements: GgtMixedAirPlacement[] = [
  {
    key: 'oa-temp',
    symbolId: 'temp_sensor',
    label: 'OA Temp',
    ontologyIds: ['outdoor_air_temperature'],
    x: 44,
    y: 46,
    w: 54,
    h: 54,
    tagX: 70,
    tagY: 34,
    tagAlign: 'left',
  },
  {
    key: 'oa-rh',
    symbolId: 'humidity_sensor',
    label: 'OA RH',
    ontologyIds: ['outdoor_air_humidity'],
    x: 104,
    y: 46,
    w: 54,
    h: 54,
    tagX: 130,
    tagY: 34,
    tagAlign: 'left',
  },
  {
    key: 'ra-temp',
    symbolId: 'temp_sensor',
    label: 'RA Temp',
    ontologyIds: ['return_air_temperature'],
    x: 340,
    y: 46,
    w: 54,
    h: 54,
    tagX: 367,
    tagY: 34,
    tagAlign: 'center',
  },
  {
    key: 'return-fan',
    symbolId: 'return_fan',
    label: 'Return Fan',
    ontologyIds: ['return_fan_command'],
    x: 512,
    y: 36,
    w: 74,
    h: 74,
    tagX: 549,
    tagY: 28,
    tagAlign: 'center',
  },
  {
    key: 'oa-damper',
    symbolId: 'damper',
    label: 'OA Damper',
    ontologyIds: ['mixed_air_damper_position'],
    x: 128,
    y: 214,
    w: 68,
    h: 68,
    tagX: 162,
    tagY: 204,
    tagAlign: 'left',
  },
  {
    key: 'prefilter',
    symbolId: 'filter',
    label: 'Filter',
    ontologyIds: ['prefilter_status'],
    x: 216,
    y: 214,
    w: 62,
    h: 62,
    tagX: 247,
    tagY: 204,
    tagAlign: 'center',
  },
  {
    key: 'ra-damper',
    symbolId: 'damper',
    label: 'RA Damper',
    ontologyIds: ['mixed_air_damper_position'],
    x: 308,
    y: 214,
    w: 68,
    h: 68,
    tagX: 342,
    tagY: 204,
    tagAlign: 'center',
  },
  {
    key: 'mixed-temp',
    symbolId: 'temp_sensor',
    label: 'Mixed Air Temp',
    ontologyIds: ['mixed_air_temperature'],
    x: 418,
    y: 208,
    w: 60,
    h: 60,
    tagX: 448,
    tagY: 198,
    tagAlign: 'center',
  },
  {
    key: 'preheat',
    symbolId: 'heating_coil',
    label: 'Preheat',
    ontologyIds: ['preheat_output'],
    x: 516,
    y: 206,
    w: 72,
    h: 72,
    tagX: 552,
    tagY: 196,
    tagAlign: 'center',
  },
  {
    key: 'cooling',
    symbolId: 'cooling_coil',
    label: 'Cooling',
    ontologyIds: ['cooling_output'],
    x: 612,
    y: 206,
    w: 72,
    h: 72,
    tagX: 648,
    tagY: 196,
    tagAlign: 'center',
  },
  {
    key: 'supply-fan',
    symbolId: 'supply_fan',
    label: 'Supply Fan',
    ontologyIds: ['supply_fan_status', 'supply_fan_command'],
    x: 726,
    y: 196,
    w: 80,
    h: 80,
    tagX: 766,
    tagY: 186,
    tagAlign: 'center',
  },
  {
    key: 'airflow',
    symbolId: 'airflow_sensor',
    label: 'Supply Flow',
    ontologyIds: ['supply_air_flow'],
    x: 848,
    y: 208,
    w: 60,
    h: 60,
    tagX: 878,
    tagY: 198,
    tagAlign: 'center',
  },
  {
    key: 'pressure',
    symbolId: 'pressure_sensor',
    label: 'Duct Pressure',
    ontologyIds: ['discharge_air_pressure_setpoint'],
    x: 940,
    y: 208,
    w: 60,
    h: 60,
    tagX: 970,
    tagY: 198,
    tagAlign: 'center',
  },
  {
    key: 'discharge-temp',
    symbolId: 'temp_sensor',
    label: 'SA Temp',
    ontologyIds: ['discharge_air_temperature', 'supply_air_temperature'],
    x: 1030,
    y: 46,
    w: 54,
    h: 54,
    tagX: 1057,
    tagY: 34,
    tagAlign: 'right',
  },
  {
    key: 'controller',
    symbolId: 'controller_panel',
    label: 'Controller',
    ontologyIds: ['application_mode', 'system_mode', 'unit_mode'],
    x: 950,
    y: 362,
    w: 132,
    h: 94,
    tagX: 1016,
    tagY: 354,
    tagAlign: 'center',
  },
  {
    key: 'vfd',
    symbolId: 'vfd_panel',
    label: 'VFD',
    ontologyIds: ['vfd_fault'],
    x: 742,
    y: 364,
    w: 102,
    h: 80,
    tagX: 793,
    tagY: 356,
    tagAlign: 'center',
  },
];

const controlRows = [
  { ontologyId: 'outdoor_air_temperature', label: 'OA Temp' },
  { ontologyId: 'outdoor_air_humidity', label: 'OA RH' },
  { ontologyId: 'return_air_temperature', label: 'RA Temp' },
  { ontologyId: 'mixed_air_temperature', label: 'Mixed Air Temp' },
  { ontologyId: 'mixed_air_damper_position', label: 'Mixed Air Damper' },
  { ontologyId: 'prefilter_status', label: 'Filter' },
  { ontologyId: 'preheat_output', label: 'Preheat' },
  { ontologyId: 'cooling_output', label: 'Cooling' },
  { ontologyId: 'supply_fan_status', label: 'Supply Fan' },
  { ontologyId: 'return_fan_command', label: 'Return Fan' },
  { ontologyId: 'supply_air_flow', label: 'Supply Flow' },
  { ontologyId: 'discharge_air_pressure_setpoint', label: 'Duct Pressure' },
  { ontologyId: 'discharge_air_temperature', label: 'SA Temp' },
  { ontologyId: 'application_mode', label: 'Controller Mode' },
  { ontologyId: 'system_mode', label: 'System Mode' },
  { ontologyId: 'unit_mode', label: 'Unit Mode' },
  { ontologyId: 'vfd_fault', label: 'VFD Fault' },
];

const defaultOntologyIds = Array.from(
  new Set(placements.flatMap((placement) => placement.ontologyIds))
).sort();

export function GgtMixedAirPoc({
  selectedOntologyIds,
  onToggleOntologyId,
  showControls = true,
  showLegend = true,
  systemKey = 'mixed_air_single_point_ahu',
  className,
}: GgtMixedAirPocProps) {
  const [internalSelectedOntologyIds, setInternalSelectedOntologyIds] = useState<string[]>(
    defaultOntologyIds
  );

  const activeOntologyIds = selectedOntologyIds ?? internalSelectedOntologyIds;
  const selectedSet = useMemo(() => new Set(activeOntologyIds), [activeOntologyIds]);

  const toggleOntologyId = (ontologyId: string) => {
    if (onToggleOntologyId) {
      onToggleOntologyId(ontologyId);
      return;
    }

    setInternalSelectedOntologyIds((current) =>
      current.includes(ontologyId) ? current.filter((id) => id !== ontologyId) : [...current, ontologyId]
    );
  };

  const isPlacementOn = (placement: GgtMixedAirPlacement) =>
    placement.ontologyIds.some((ontologyId) => selectedSet.has(ontologyId));

  const renderTag = (placement: GgtMixedAirPlacement) => {
    const isOn = isPlacementOn(placement);
    const text = placement.label;
    const width = Math.max(text.length * 7.2 + 18, 94);
    const x = placement.tagAlign === 'right' ? placement.tagX - width : placement.tagX - width / 2;
    const y = placement.tagY - 16;

    return (
      <g
        key={`${placement.key}-tag`}
        style={{ cursor: onToggleOntologyId || !selectedOntologyIds ? 'pointer' : 'default' }}
        onClick={onToggleOntologyId || !selectedOntologyIds ? () => toggleOntologyId(placement.ontologyIds[0]) : undefined}
        opacity={isOn ? 1 : 0.22}
      >
        <rect x={x} y={y} width={width} height={22} rx={7} className={isOn ? 'tag-box selected' : 'tag-box'} />
        <text
          x={x + 10}
          y={y + 15}
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            fill: isOn ? '#1d4ed8' : '#64748b',
            pointerEvents: 'none',
          }}
        >
          {text}
        </text>
      </g>
    );
  };

  const renderPlacement = (placement: GgtMixedAirPlacement) => {
    const symbol = symbolById.get(placement.symbolId);
    const isOn = isPlacementOn(placement);
    const highlight = isOn ? 'url(#selectedGlow)' : undefined;

    if (!symbol) return null;

    return (
      <g key={placement.key}>
        <image
          href={symbol.output_svg_path}
          x={placement.x}
          y={placement.y}
          width={placement.w}
          height={placement.h}
          opacity={isOn ? 1 : 0.18}
          filter={highlight}
          style={{ cursor: onToggleOntologyId || !selectedOntologyIds ? 'pointer' : 'default' }}
          onClick={onToggleOntologyId || !selectedOntologyIds ? () => toggleOntologyId(placement.ontologyIds[0]) : undefined}
        />
        <rect
          x={placement.x - 3}
          y={placement.y - 3}
          width={placement.w + 6}
          height={placement.h + 6}
          rx={10}
          ry={10}
          fill="transparent"
          stroke={isOn ? '#f59e0b' : '#94a3b8'}
          strokeWidth={isOn ? 2.5 : 1}
          opacity={isOn ? 0.95 : 0.18}
          pointerEvents="none"
        />
        {renderTag(placement)}
      </g>
    );
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'stretch',
        flexWrap: 'wrap',
        width: '100%',
      }}
    >
      {showControls && (
        <aside
          style={{
            width: 300,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 12,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>GGT Mixed Air AHU</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Symbol-first assembly built from the extracted GGT SVG assets.</div>
            </div>
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '5px 8px',
                borderRadius: 999,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f766e',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              GGT
            </div>
          </div>

          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              fontSize: 12,
              color: '#334155',
            }}
          >
            rendererMode = <strong>ontology</strong>
            <br />
            systemKey = <strong>{systemKey}</strong>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: 440, overflow: 'auto', paddingRight: 2 }}>
            {controlRows.map((row) => {
              const checked = selectedSet.has(row.ontologyId);
              return (
                <label
                  key={row.ontologyId}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 10,
                    border: '1px solid ' + (checked ? '#bfdbfe' : '#e2e8f0'),
                    background: checked ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOntologyId(row.ontologyId)}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: '#2563eb', wordBreak: 'break-word' }}>{row.ontologyId}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </aside>
      )}

      <section style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              GGT / XAML derived
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Mixed Air AHU</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#155e75', fontSize: 12, border: '1px solid #cffafe' }}>
              symbol assembly
            </span>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, border: '1px solid #dbeafe' }}>
              ontology controlled
            </span>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#f8fafc', color: '#475569', fontSize: 12, border: '1px solid #e2e8f0' }}>
              {activeOntologyIds.length} selected ontology ids
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            minWidth: 0,
            borderRadius: 18,
            border: '1px solid #dbe4ee',
            overflow: 'hidden',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96))',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
          }}
        >
          <svg
            viewBox="0 0 1220 560"
            width="100%"
            style={{ display: 'block' }}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="GGT mixed air AHU proof of concept"
          >
            <defs>
              <linearGradient id="sectionFill" x1="0" x2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef4fb" />
              </linearGradient>
              <marker id="arrowHead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 Z" fill="#334155" />
              </marker>
              <filter id="selectedGlow" x="-24%" y="-24%" width="148%" height="148%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#f59e0b" floodOpacity="0.76" />
              </filter>
            </defs>

            <rect x="0" y="0" width="1220" height="560" fill="#f8fafc" />

            <rect x="78" y="126" width="298" height="284" rx="18" fill="url(#sectionFill)" stroke="#cbd5e1" />
            <rect x="390" y="126" width="316" height="284" rx="18" fill="url(#sectionFill)" stroke="#cbd5e1" />
            <rect x="718" y="126" width="430" height="284" rx="18" fill="url(#sectionFill)" stroke="#cbd5e1" />

            <text x="92" y="148" style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, fontWeight: 700, fill: '#64748b', letterSpacing: '0.16em' }}>
              MIX BOX
            </text>
            <text x="404" y="148" style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, fontWeight: 700, fill: '#64748b', letterSpacing: '0.16em' }}>
              COILS
            </text>
            <text x="732" y="148" style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, fontWeight: 700, fill: '#64748b', letterSpacing: '0.16em' }}>
              SUPPLY / CONTROLS
            </text>

            <path d="M76 114 H 590" stroke="#475569" strokeWidth="18" strokeLinecap="round" opacity="0.14" />
            <path d="M76 114 H 590" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
            <path d="M76 430 H 240" stroke="#475569" strokeWidth="18" strokeLinecap="round" opacity="0.14" />
            <path d="M76 430 H 240" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
            <path d="M590 250 H 1128" stroke="#475569" strokeWidth="18" strokeLinecap="round" opacity="0.14" />
            <path d="M590 250 H 1128" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />

            <path d="M240 430 V 250 H 330" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M240 114 V 220 H 330" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M590 250 V 176" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M878 250 V 196" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M1030 250 V 196" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />

            <path d="M240 250 H 330" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" markerEnd="url(#arrowHead)" />
            <path d="M330 250 H 422" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M482 250 H 516" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M588 250 H 612" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M684 250 H 726" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M806 250 H 848" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M908 250 H 940" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" />
            <path d="M1000 250 H 1128" stroke="#0f172a" strokeWidth="2.4" opacity="0.48" markerEnd="url(#arrowHead)" />

            {placements.map(renderPlacement)}

            <text x="76" y="500" style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, fill: '#64748b' }}>
              GGT symbols and ontology IDs drive visibility. Full-page Visio exports are not used as the live asset.
            </text>
          </svg>
        </div>

        {showLegend && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: '#0f766e' }} />
              dampers and airflow
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: '#2563eb' }} />
              temperature and sensors
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: '#dc2626' }} />
              heating
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: '#4f46e5' }} />
              fan / drive
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: '#f59e0b' }} />
              selected point
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
