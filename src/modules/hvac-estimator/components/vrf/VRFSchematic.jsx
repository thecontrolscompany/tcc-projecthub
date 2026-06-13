import { useEffect, useMemo, useState } from "react";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import {
  DEFAULT_VRF_CFG,
  VRF_COMPS,
  buildDefaultVrfSelected,
  getVisibleVrfComponents,
  normalizeVrfCfg,
  reconcileVrfSelected,
} from "./vrfData.js";

export default function VRFPage() {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const isEditing = !!editingItem && editingItem.type === "vrf";
  const [cfg, setCfg] = useState(() =>
    isEditing ? normalizeVrfCfg(editingItem.cfg) : normalizeVrfCfg(DEFAULT_VRF_CFG)
  );
  const visibleComponents = useMemo(() => getVisibleVrfComponents(cfg), [cfg]);

  useEffect(() => {
    setCfg(isEditing ? normalizeVrfCfg(editingItem.cfg) : normalizeVrfCfg(DEFAULT_VRF_CFG));
  }, [editingItem?.id, isEditing]);

  useEffect(() => {
    if (subPage?.type !== "vrf" || !subPage?.conduitFillDraft?.cfg) return;
    setCfg(normalizeVrfCfg(subPage.conduitFillDraft.cfg));
  }, [subPage]);

  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = sessionStorage.getItem("wizard_launch_config");
      if (!raw) return;
      const { systemId, configId } = JSON.parse(raw);
      if (systemId !== "vrf") return;
      sessionStorage.removeItem("wizard_launch_config");
      if (configId === "idu" || configId === "odu" || configId === "full") {
        setCfg(normalizeVrfCfg({ vrfRole: configId }));
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <UnitEditorPage
      type="vrf"
      comps={visibleComponents}
      title="VRF System"
      badge="VRF"
      accent="#047857"
      accentBg="#ECFDF5"
      accentBorder="#6EE7B7"
      defaultTag="VRF"
      defaultLocation="VRF indoor / outdoor network"
      defaultInstallType={quoteDefault}
      pageKey="vrf"
      flowKind="vrf"
      cfg={cfg}
      buildDefaultSelected={(comps, activeCfg) =>
        buildDefaultVrfSelected(activeCfg, { components: comps })
      }
      normalizeSelected={(selected, comps, activeCfg) =>
        reconcileVrfSelected(selected, activeCfg, { components: comps })
      }
      reconcileSelected={(selected, comps, activeCfg) =>
        reconcileVrfSelected(selected, activeCfg, { components: comps })
      }
    />
  );
}
