'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SystemMetadata, DeviceConfig } from './types';
import { DeviceMarker } from './DeviceMarker';

interface Props {
  metadata: SystemMetadata;
  svgUrl: string;
  devices: DeviceConfig[];
  selectedDevice?: string | null;
  selectedOntologyIds?: string[];
  presentationMode?: 'default' | 'selected-only';
  onDeviceClick?: (key: string) => void;
  className?: string;
}

export function SystemGraphic({
  metadata,
  svgUrl,
  devices,
  selectedDevice,
  selectedOntologyIds,
  presentationMode = 'default',
  onDeviceClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [svgError, setSvgError] = useState<string | null>(null);
  const [selectedElementExists, setSelectedElementExists] = useState(false);
  const [resolvedElementIds, setResolvedElementIds] = useState<string[]>([]);

  useEffect(() => {
    setSvgContent(null);
    setSvgError(null);
    setSelectedElementExists(false);
    setResolvedElementIds([]);

    fetch(svgUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load SVG: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        // Strip XML declaration and extract the <svg> element content
        const match = text.match(/<svg[\s\S]*<\/svg>/i);
        setSvgContent(match ? match[0] : text);
      })
      .catch((err: unknown) => {
        setSvgError(err instanceof Error ? err.message : String(err));
      });
  }, [svgUrl]);

  const selectedAnchors = useMemo(() => {
    const ids = selectedOntologyIds && selectedOntologyIds.length > 0
      ? selectedOntologyIds
      : selectedDevice
        ? [devices.find((device) => device.key === selectedDevice)?.ontology_id ?? selectedDevice]
        : [];
    const idSet = new Set(ids);
    return devices.filter((device) => idSet.has(device.ontology_id ?? device.key) || idSet.has(device.key));
  }, [devices, selectedDevice, selectedOntologyIds]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !svgContent || selectedAnchors.length === 0) {
      setSelectedElementExists(false);
      setResolvedElementIds([]);
      return;
    }

    root.querySelectorAll('.projecthub-svg-highlight').forEach((element) => {
      element.classList.remove('projecthub-svg-highlight');
      element.removeAttribute('data-projecthub-highlight');
    });

    let foundAny = false;
    const resolvedIds: string[] = [];
    for (const anchor of selectedAnchors) {
      const targetId = anchor.svg_element_id?.trim();
      if (!targetId) continue;
      const element = root.querySelector(`#${escapeSvgSelector(targetId)}`) as SVGElement | null;
      if (!element) continue;
      foundAny = true;
      resolvedIds.push(targetId);
      element.classList.add('projecthub-svg-highlight');
      element.setAttribute('data-projecthub-highlight', 'true');
    }

    if (presentationMode === 'selected-only') {
      const visibleIds = new Set(resolvedIds);
      for (const anchor of devices) {
        const targetId = anchor.svg_element_id?.trim();
        if (!targetId) continue;
        const element = root.querySelector(`#${escapeSvgSelector(targetId)}`) as SVGElement | null;
        if (!element) continue;
        if (visibleIds.has(targetId)) {
          element.style.opacity = '1';
          element.style.visibility = 'visible';
          element.style.display = '';
        } else {
          element.style.opacity = '0';
          element.style.visibility = 'hidden';
          element.style.display = 'none';
        }
      }
    }

    setSelectedElementExists(foundAny);
    setResolvedElementIds(resolvedIds);
  }, [devices, presentationMode, selectedAnchors, svgContent]);

  const { page_width_px: W, page_height_px: H } = metadata;
  const fallbackAnchors = selectedAnchors.filter((anchor) => {
    const targetId = anchor.svg_element_id?.trim();
    return !targetId || !resolvedElementIds.includes(targetId);
  });

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: 'block',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          maxHeight: '100%',
          overflow: 'hidden',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {selectedElementExists && (
          <style>{`
            .projecthub-svg-highlight {
              filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.95)) saturate(1.2);
            }
            .projecthub-svg-highlight *,
            .projecthub-svg-highlight path,
            .projecthub-svg-highlight line,
            .projecthub-svg-highlight polyline,
            .projecthub-svg-highlight polygon,
            .projecthub-svg-highlight rect,
            .projecthub-svg-highlight circle,
            .projecthub-svg-highlight ellipse,
            .projecthub-svg-highlight text {
              filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.95));
            }
          `}</style>
        )}

        {/* Base system graphic */}
        {svgContent ? (
          <g
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{ pointerEvents: 'none' }}
          />
        ) : svgError ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#ef4444" fontSize="14">
            {svgError}
          </text>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize="14">
            Loading…
          </text>
        )}

        {/* Overlay fallback only when the linked SVG element is missing or unstable. */}
        {fallbackAnchors.map((anchor) => (
          <DeviceMarker
            key={anchor.key}
            deviceType={anchor.device_type}
            x={anchor.svg_x ?? anchor.x ?? 0}
            y={anchor.svg_y ?? anchor.y ?? 0}
            label={anchor.display_label ?? anchor.label}
            visible={anchor.visible}
            selected
            onClick={onDeviceClick ? () => onDeviceClick(anchor.key) : undefined}
          />
        ))}
      </svg>
    </div>
  );
}

function escapeSvgSelector(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
