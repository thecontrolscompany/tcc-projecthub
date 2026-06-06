'use client';

import { normalizeAhuCfg } from '@/modules/hvac-estimator/components/ahu/ahuData';
import { resolveProjectHubGraphicsSource, type EstimatorSelectionEntry } from './projecthubGraphics';

export const PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW_FLAG = 'NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW';
export const PROJECTHUB_TEMPLATE_GRAPHICS_TRIAL_TEMPLATE_ID = 'mixed_air_single_duct';

export type ProjectHubTemplateGraphicsTrial = {
  templateId: string;
  selectedOntologyIds: string[];
};

function isEnabled() {
  return process.env.NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW === 'true';
}

export function isProjectHubTemplateGraphicsPreviewEnabled() {
  return isEnabled();
}

export function resolveProjectHubTemplateGraphicsTrial(
  type: string,
  cfg: Record<string, unknown>,
  selected: EstimatorSelectionEntry[]
): ProjectHubTemplateGraphicsTrial | null {
  if (!isEnabled()) return null;
  if (type !== 'ahu') return null;

  const graphicsSource = resolveProjectHubGraphicsSource(type, cfg, selected);
  if (!graphicsSource) return null;

  const normalized = normalizeAhuCfg(cfg);
  if (normalized.ahuType !== 'mixed') return null;

  return {
    templateId: PROJECTHUB_TEMPLATE_GRAPHICS_TRIAL_TEMPLATE_ID,
    selectedOntologyIds: graphicsSource.selectedOntologyIds,
  };
}
