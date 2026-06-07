'use client';

import { normalizeAhuCfg } from '@/modules/hvac-estimator/components/ahu/ahuData';
import { resolveProjectHubGraphicsSource, type EstimatorSelectionEntry } from './projecthubGraphics';

export const PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW_FLAG = 'NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW';
export const PROJECTHUB_TEMPLATE_GRAPHICS_TRIAL_TEMPLATE_ID = 'mixed_air_single_duct';

export type ProjectHubTemplateGraphicsTrial = {
  templateId: string;
  selectedOntologyIds: string[];
  selectedSelectionIds: string[];
  selectedSelectionLabelsById: Record<string, string>;
  selectedSelectionRolesById: Record<string, string>;
  selectedTemplateKeysBySelectionId: Record<string, string[]>;
};

const AHU_TEMPLATE_KEYS_BY_COMPONENT: Record<string, string[]> = {
  "oa-temp": ["CC-T"],
  "ma-temp": ["MA-T"],
  "sa-temp": ["DA-T", "DAT-SP"],
  "ra-temp": ["RA-T", "RAT-SP"],
  "hw-sup-t": ["PHWL-T"],
  "hw-ret-t": ["PHWE-T"],
  "chw-sup-t": ["CCWE-T"],
  "chw-ret-t": ["CCWL-T"],
  "oa-rh": ["RH-O"],
  "ra-rh": ["RA-H", "RAH-SP"],
  "sa-static": ["DAP-SP"],
  "ra-static": ["RAP-SP"],
  "oa-damper": ["MOAD-S", "MOAD-C"],
  "ra-damper": ["MAD-O"],
  "ea-damper": ["GEF-S"],
  "min-oa-d": ["MOAD-S", "MOAD-C"],
  "filter-dp": ["PFILT-S", "FFILT-S"],
  "ph-valve": ["PH-O"],
  "ph-valve-2pos": ["PH-O"],
  "ph-steam-valve": ["PH-O"],
  "htg-valve": ["PH-O"],
  "htg-valve-2pos": ["PH-O"],
  "htg-valve-incr": ["PH-O"],
  "htg-steam-valve": ["PH-O"],
  "rh-valve": ["RH-O"],
  "rh-valve-2pos": ["RH-O"],
  "rh-valve-incr": ["RH-O"],
  "rh-elec-heat": ["RH-O"],
  "clg-valve": ["CLG-O", "CLG-POS", "CC-T"],
  "clg-valve-2pos": ["CLG-O", "CLG-POS", "CC-T"],
  "clg-dx-staged": [],
  "vfd-sf": ["SF-C", "SF-S", "SF-O"],
  "sf-starter": ["SF-C", "SF-S", "SF-O"],
  "vfd-rf": ["RF-C", "RF-S", "RF-O"],
  "rf-starter": ["RF-C", "RF-S", "RF-O"],
  "smoke-sa": ["DA-SD"],
  "smoke-ra": ["RA-SD"],
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

  try {
    const graphicsSource = resolveProjectHubGraphicsSource(type, cfg, selected);
    if (!graphicsSource) return null;

    const normalized = normalizeAhuCfg(cfg);
    if (normalized.ahuType !== 'mixed') return null;

    const selectedTemplateKeys = [...new Set(selected.flatMap((entry) => AHU_TEMPLATE_KEYS_BY_COMPONENT[entry.id] || []))];

    return {
      templateId: PROJECTHUB_TEMPLATE_GRAPHICS_TRIAL_TEMPLATE_ID,
      selectedOntologyIds: [...new Set([...graphicsSource.selectedOntologyIds, ...selectedTemplateKeys])],
      selectedSelectionIds: graphicsSource.selectedSelectionIds,
      selectedSelectionLabelsById: graphicsSource.selectedSelectionLabelsById,
      selectedSelectionRolesById: graphicsSource.selectedSelectionRolesById,
      selectedTemplateKeysBySelectionId: graphicsSource.selectedTemplateKeysBySelectionId,
    };
  } catch {
    return null;
  }
}
