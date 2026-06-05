'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { SystemMetadata, DeviceConfig, DeviceType } from './types';
import { SystemGraphic } from './SystemGraphic';

interface Props {
  metadata: SystemMetadata;
  svgUrl: string;
}

const DEVICE_TYPE_GROUPS: { label: string; types: DeviceType[] }[] = [
  { label: 'Sensors', types: ['temp_sensor', 'humidity_sensor', 'pressure_sensor', 'dp_sensor', 'flow_sensor', 'co2_sensor'] },
  { label: 'Air-Side', types: ['supply_fan', 'return_fan', 'exhaust_fan', 'fan', 'cooling_coil', 'heating_coil', 'preheat_coil', 'coil', 'oa_damper', 'ra_damper', 'ea_damper', 'damper', 'filter', 'heat_wheel', 'humidifier'] },
  { label: 'Water-Side', types: ['chw_valve', 'hw_valve', 'steam_valve', 'valve_2way', 'valve_3way', 'valve', 'pump', 'chiller', 'boiler', 'cooling_tower', 'heat_exchanger'] },
  { label: 'Controls', types: ['vfd', 'controller', 'vav_controller', 'panel', 'network_device'] },
];

function formatConfidence(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

export function SystemGraphicViewer({ metadata, svgUrl }: Props) {
  const initialDevices: DeviceConfig[] = useMemo(
    () =>
      Object.entries(metadata.anchors).map(([key, anchor]) => ({
        key,
        label: anchor.display_label ?? key.replace(/_/g, ' '),
        device_type: anchor.device_type,
        visible: true,
        x: anchor.x,
        y: anchor.y,
        ontology_id: anchor.ontology_id ?? key,
        display_label: anchor.display_label ?? key.replace(/_/g, ' '),
        svg_element_id: anchor.svg_element_id,
        svg_element_kind: anchor.svg_element_kind,
        svg_x: anchor.svg_x,
        svg_y: anchor.svg_y,
        confidence_score: anchor.confidence_score,
        match_reason: anchor.match_reason,
        visio_source_file: anchor.visio_source_file,
        visio_stencil_name: anchor.visio_stencil_name,
        visio_master_name: anchor.visio_master_name,
        visio_shape_name: anchor.visio_shape_name,
        visio_group_name: anchor.visio_group_name,
        source_kind: anchor.source_kind,
        source_system: anchor.source_system,
        source_key: anchor.source_key,
        link_status: anchor.link_status,
      })),
    [metadata.anchors]
  );

  const [devices, setDevices] = useState<DeviceConfig[]>(initialDevices);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const selectedAnchor = useMemo(
    () => devices.find((device) => device.key === selectedDevice) ?? null,
    [devices, selectedDevice]
  );

  useEffect(() => {
    setDevices(initialDevices);
    setSelectedDevice(initialDevices[0]?.key ?? null);
  }, [initialDevices]);

  const toggle = useCallback((key: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.key === key ? { ...d, visible: !d.visible } : d))
    );
  }, []);

  const toggleGroup = useCallback((types: DeviceType[], allOn: boolean) => {
    setDevices((prev) =>
      prev.map((d) => (types.includes(d.device_type) ? { ...d, visible: !allOn } : d))
    );
  }, []);

  const allOn = devices.every((d) => d.visible);
  const allOff = devices.every((d) => !d.visible);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Left: controls */}
      <div style={{
        minWidth: 220, background: 'white', border: '1px solid #e2e8f0',
        borderRadius: 6, padding: 12, fontSize: 13,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#1e293b' }}>
          {metadata.system.replace(/_/g, ' ').toUpperCase()}
        </div>

        {/* All on/off */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            onClick={() => setDevices((p) => p.map((d) => ({ ...d, visible: true })))}
            disabled={allOn}
            style={btnStyle(!allOn)}
          >
            All On
          </button>
          <button
            onClick={() => setDevices((p) => p.map((d) => ({ ...d, visible: false })))}
            disabled={allOff}
            style={btnStyle(!allOff)}
          >
            All Off
          </button>
        </div>

        {/* Group controls */}
        {DEVICE_TYPE_GROUPS.map((group) => {
          const groupDevices = devices.filter((d) => group.types.includes(d.device_type));
          if (groupDevices.length === 0) return null;
          const allGroupOn = groupDevices.every((d) => d.visible);

          return (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: 600, color: '#475569', marginBottom: 4, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span>{group.label}</span>
                <button
                  onClick={() => toggleGroup(group.types, allGroupOn)}
                  style={{ ...btnStyle(true), padding: '1px 6px', fontSize: 10 }}
                >
                  {allGroupOn ? 'Hide' : 'Show'}
                </button>
              </div>
              {groupDevices.map((d) => (
                <label
                  key={d.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '2px 4px', borderRadius: 3, cursor: 'pointer',
                    background: selectedDevice === d.key ? '#eff6ff' : 'transparent',
                  }}
                  onClick={() => setSelectedDevice(d.key === selectedDevice ? null : d.key)}
                  >
                  <input
                    type="checkbox"
                    checked={d.visible}
                    onChange={() => toggle(d.key)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  <span style={{ color: d.visible ? '#1e293b' : '#94a3b8', fontSize: 12, lineHeight: 1.2 }}>
                    <span style={{ display: 'block' }}>{d.display_label ?? d.label}</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{d.ontology_id ?? d.key}</span>
                  </span>
                </label>
              ))}
            </div>
          );
        })}

        {/* Devices without a group match */}
        {(() => {
          const allGroupTypes = DEVICE_TYPE_GROUPS.flatMap((g) => g.types);
          const ungrouped = devices.filter((d) => !allGroupTypes.includes(d.device_type));
          if (ungrouped.length === 0) return null;
          return (
            <div>
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4, fontSize: 11, textTransform: 'uppercase' }}>
                Other
              </div>
              {ungrouped.map((d) => (
                <label
                  key={d.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', cursor: 'pointer' }}
                  onClick={() => setSelectedDevice(d.key === selectedDevice ? null : d.key)}
                >
                  <input type="checkbox" checked={d.visible} onChange={() => toggle(d.key)} />
                  <span style={{ fontSize: 12, lineHeight: 1.2 }}>
                    <span style={{ display: 'block' }}>{d.display_label ?? d.label}</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{d.ontology_id ?? d.key}</span>
                  </span>
                </label>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Right: graphic */}
      <div style={{ flex: 1 }}>
        <SystemGraphic
          metadata={metadata}
          svgUrl={svgUrl}
          devices={devices}
          selectedDevice={selectedDevice}
          selectedOntologyIds={selectedAnchor ? [selectedAnchor.ontology_id ?? selectedAnchor.key] : []}
          onDeviceClick={(key) => setSelectedDevice(key === selectedDevice ? null : key)}
        />
        {selectedDevice && (
          <div style={{
            marginTop: 8, padding: '6px 10px', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 12,
          }}>
            <strong>Selected:</strong> {selectedAnchor?.display_label ?? selectedDevice} —{' '}
            <span style={{ color: '#2563eb' }}>{selectedAnchor?.ontology_id ?? selectedDevice}</span>
            <div style={{ marginTop: 4, color: '#475569' }}>
              <span>Confidence: {formatConfidence(selectedAnchor?.confidence_score)}</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span>Element: {selectedAnchor?.svg_element_id ? selectedAnchor.svg_element_id : 'overlay fallback'}</span>
            </div>
            <div style={{ marginTop: 4, color: '#475569' }}>
              <span>{selectedAnchor?.visio_source_file ?? '-'}</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span>{selectedAnchor?.visio_shape_name ?? selectedAnchor?.visio_master_name ?? '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    background: enabled ? '#f1f5f9' : '#f8fafc',
    color: enabled ? '#1e293b' : '#cbd5e1',
    cursor: enabled ? 'pointer' : 'default',
  };
}
