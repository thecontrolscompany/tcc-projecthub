import { useEffect, useMemo, useState } from "react";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import {
  DEFAULT_RTU_CFG,
  getVisibleRtuComponents,
  normalizeRtuCfg,
  reconcileRtuSelected,
  toggleRtuComponentSelection,
} from "./rtuData.js";

export default function RTUPage({ onBack = null } = {}) {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const isEditing = !!editingItem && editingItem.type === "rtu";
  const [cfg, setCfg] = useState(() => isEditing ? normalizeRtuCfg(editingItem.cfg) : DEFAULT_RTU_CFG);
  const visibleComponents = useMemo(() => getVisibleRtuComponents(cfg), [cfg]);

  useEffect(() => {
    setCfg(isEditing ? normalizeRtuCfg(editingItem.cfg) : DEFAULT_RTU_CFG);
  }, [editingItem?.id, isEditing]);

  useEffect(() => {
    if (subPage?.type !== "rtu" || !subPage?.conduitFillDraft?.cfg) return;
    setCfg(normalizeRtuCfg(subPage.conduitFillDraft.cfg));
  }, [subPage]);

  // Apply wizard pre-selection on first mount only (runs after the above, so it wins)
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = sessionStorage.getItem("wizard_launch_config");
      if (!raw) return;
      const { systemId, configId } = JSON.parse(raw);
      if (systemId !== "rtu") return;
      sessionStorage.removeItem("wizard_launch_config");
      if (configId === "cool-only" || configId === "heat-pump") {
        setCfg(normalizeRtuCfg({ heatingType: "none" }));
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCfg = patch => setCfg(prev => normalizeRtuCfg({ ...prev, ...patch }));

  return (
    <UnitEditorPage
      onBack={onBack}
      type="rtu"
      comps={visibleComponents}
      title="Roof Top Unit"
      badge="RTU"
      defaultTag="RTU"
      defaultLocation="Rooftop"
      defaultInstallType={quoteDefault}
      pageKey="rtu"
      flowKind="rtu"
      cfg={cfg}
      buildDefaultSelected={(comps, activeCfg) =>
        reconcileRtuSelected([], activeCfg, { components: comps })
      }
      normalizeSelected={(selected, comps, activeCfg) =>
        reconcileRtuSelected(selected, activeCfg, { components: comps })
      }
      reconcileSelected={(selected, comps, activeCfg) =>
        reconcileRtuSelected(selected, activeCfg, { components: comps })
      }
      toggleSelected={(selected, componentId, comps, activeCfg) =>
        toggleRtuComponentSelection(selected, componentId, { components: comps, cfg: activeCfg })
      }
    />
  );
}
