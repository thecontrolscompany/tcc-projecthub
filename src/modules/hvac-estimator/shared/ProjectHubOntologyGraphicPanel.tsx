'use client';

import React, { useMemo } from 'react';
import { SystemGraphic } from '@/components/system-graphic';
import type { DeviceConfig, DeviceType, SystemMetadata } from '@/components/system-graphic/types';
import { buildSystemMetadata, getSystemPreviewLabel, getSystemSvgUrl } from '@/data/projecthub/projecthub-data';
import { resolveProjectHubGraphicsSource, type EstimatorSelectionEntry, type ProjectHubGraphicsSource } from './projecthubGraphics';
import { ProjectHubTemplateGraphicPanel } from './ProjectHubTemplateGraphicPanel';
import { resolveProjectHubTemplateGraphicsTrial } from './projecthubTemplateGraphics';

type Props = {
  type: string;
  cfg: Record<string, unknown>;
  selected: EstimatorSelectionEntry[];
  className?: string;
  title?: string;
};

function buildDevices(metadata: SystemMetadata): DeviceConfig[] {
  return Object.entries(metadata.anchors).map(([key, anchor]) => ({
    key,
    label: anchor.display_label ?? key.replace(/_/g, ' '),
    device_type: anchor.device_type as DeviceType,
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
  }));
}

export function ProjectHubOntologyGraphicPanel({ type, cfg, selected, className, title }: Props) {
  const source = useMemo<ProjectHubGraphicsSource | null>(
    () => resolveProjectHubGraphicsSource(type, cfg, selected),
    [type, cfg, selected]
  );

  const metadata = useMemo(
    () => (source ? buildSystemMetadata(source.systemKey) : null),
    [source]
  );

  const devices = useMemo(() => (metadata ? buildDevices(metadata) : []), [metadata]);
  const templateTrial = useMemo(
    () => resolveProjectHubTemplateGraphicsTrial(type, cfg, selected),
    [type, cfg, selected]
  );

  if (!source || !metadata) return null;

  const fallbackGraphic = (
    <SystemGraphic
      metadata={metadata}
      svgUrl={getSystemSvgUrl(source.systemKey)}
      devices={devices}
      selectedOntologyIds={source.selectedOntologyIds}
    />
  );

  if (templateTrial) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ProjectHubTemplateGraphicPanel
          templateId={templateTrial.templateId}
          selectedOntologyIds={templateTrial.selectedOntologyIds}
          selectedSelectionIds={templateTrial.selectedSelectionIds}
          selectedSelectionLabelsById={templateTrial.selectedSelectionLabelsById}
          selectedSelectionRolesById={templateTrial.selectedSelectionRolesById}
          selectedTemplateKeysBySelectionId={templateTrial.selectedTemplateKeysBySelectionId}
          fallback={fallbackGraphic}
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(title || source.systemKey) && (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <strong style={{ color: '#1e293b' }}>{title ?? getSystemPreviewLabel(source.systemKey)}</strong>
          <span style={{ marginLeft: 8 }}>
            {source.selectedOntologyIds.length ? `${source.selectedOntologyIds.length} selected ontology ids` : 'no selected ontology ids'}
          </span>
        </div>
      )}
      {fallbackGraphic}
    </div>
  );
}
