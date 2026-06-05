'use client';

import React, { useMemo, useState } from 'react';
import { SystemGraphicViewer } from '@/components/system-graphic';
import {
  buildSystemMetadata,
  getSystemAssets,
  getSystemPreviewLabel,
  getSystemSvgUrl,
  PROJECTHUB_SYSTEMS,
  type ProjectHubSystemKey,
} from '@/data/projecthub/projecthub-data';

export default function SystemPreviewPage() {
  const [selectedSystem, setSelectedSystem] = useState<ProjectHubSystemKey>(PROJECTHUB_SYSTEMS[0].key);

  const metadata = useMemo(() => buildSystemMetadata(selectedSystem), [selectedSystem]);
  const svgUrl = useMemo(() => getSystemSvgUrl(selectedSystem), [selectedSystem]);
  const assets = useMemo(() => getSystemAssets(selectedSystem), [selectedSystem]);

  const linkedCount = useMemo(
    () => assets.filter((asset) => Boolean(asset.svg_element_id || asset.svg_id)).length,
    [assets]
  );

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1400 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>
        Ontology-Backed System Graphic Preview
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        ProjectHub demo route using ontology_id selection, linked SVG element highlighting, and overlay fallback support.
      </p>

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>System:</label>
        <select
          value={selectedSystem}
          onChange={(e) => setSelectedSystem(e.target.value as ProjectHubSystemKey)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 13,
            background: 'white',
          }}
        >
          {PROJECTHUB_SYSTEMS.map((system) => (
            <option key={system.key} value={system.key}>
              {system.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {assets.length} ontology-backed points, {linkedCount} linked SVG elements
        </span>
      </div>

      {!metadata ? (
        <div style={{
          padding: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#b91c1c',
          fontSize: 13,
        }}>
          Unable to build graphics metadata for <strong>{getSystemPreviewLabel(selectedSystem)}</strong>.
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 6,
            fontSize: 12,
            color: '#166534',
          }}>
            Loaded <strong>{metadata.system}</strong> from ontology-backed assets. Select a point in the left panel to
            highlight the matching SVG element or fall back to the overlay marker.
          </div>
          <SystemGraphicViewer metadata={metadata} svgUrl={svgUrl} />
        </>
      )}

      <div style={{ marginTop: 24, fontSize: 11, color: '#94a3b8' }}>
        This route is intentionally narrow in scope: the selection model uses ontology_id, the SVG remains a presentation
        layer, and the underlying estimator state will stay separate when the viewer is wired into the live estimate
        workspace.
      </div>
    </div>
  );
}
