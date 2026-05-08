import { useEffect, useMemo, useState } from "react";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import {
  DEFAULT_UH_CFG,
  getVisibleUhComponents,
  normalizeUhCfg,
  reconcileUhSelected,
  toggleUhComponentSelection,
} from "./uhData.js";

export default function UHPage() {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const isEditing = !!editingItem && editingItem.type === "uh";
  const [cfg, setCfg] = useState(() => isEditing ? normalizeUhCfg(editingItem.cfg) : DEFAULT_UH_CFG);
  const visibleComponents = useMemo(() => getVisibleUhComponents(cfg), [cfg]);

  useEffect(() => {
    setCfg(isEditing ? normalizeUhCfg(editingItem.cfg) : DEFAULT_UH_CFG);
  }, [editingItem?.id, isEditing]);

  useEffect(() => {
    if (subPage?.type !== "uh" || !subPage?.conduitFillDraft?.cfg) return;
    setCfg(normalizeUhCfg(subPage.conduitFillDraft.cfg));
  }, [subPage]);

  // Apply wizard pre-selection on first mount only (runs after the above, so it wins)
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = sessionStorage.getItem("wizard_launch_config");
      if (!raw) return;
      const { systemId, configId } = JSON.parse(raw);
      if (systemId !== "uh") return;
      sessionStorage.removeItem("wizard_launch_config");
      if (configId === "elec-uh") setCfg(normalizeUhCfg({ heatingType: "electric-3stage" }));
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCfg = patch => setCfg(prev => normalizeUhCfg({ ...prev, ...patch }));

  return (
    <UnitEditorPage
      type="uh"
      comps={visibleComponents}
      title="Unit Heater"
      badge="UH"
      defaultTag="UH"
      defaultLocation="Mech Room"
      defaultInstallType={quoteDefault}
      pageKey="uh"
      flowKind="uh"
      cfg={cfg}
      buildDefaultSelected={(comps, activeCfg) =>
        reconcileUhSelected([], activeCfg, { components: comps })
      }
      normalizeSelected={(selected, comps, activeCfg) =>
        reconcileUhSelected(selected, activeCfg, { components: comps })
      }
      reconcileSelected={(selected, comps, activeCfg) =>
        reconcileUhSelected(selected, activeCfg, { components: comps })
      }
      toggleSelected={(selected, componentId, comps, activeCfg) =>
        toggleUhComponentSelection(selected, componentId, { components: comps, cfg: activeCfg })
      }
    />
  );
}
