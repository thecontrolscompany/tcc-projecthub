import { useEffect, useMemo, useState } from "react";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import {
  buildDefaultDxSelected,
  DEFAULT_DX_CFG,
  getVisibleDxComponents,
  normalizeDxCfg,
  reconcileDxSelected,
} from "./dxData.js";

export default function DXPage() {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const isEditing = !!editingItem && editingItem.type === "dx";
  const [cfg, setCfg] = useState(() =>
    isEditing ? normalizeDxCfg(editingItem.cfg) : normalizeDxCfg(DEFAULT_DX_CFG)
  );
  const visibleComponents = useMemo(() => getVisibleDxComponents(cfg), [cfg]);

  useEffect(() => {
    setCfg(isEditing ? normalizeDxCfg(editingItem.cfg) : normalizeDxCfg(DEFAULT_DX_CFG));
  }, [editingItem?.id, isEditing]);

  useEffect(() => {
    if (subPage?.type !== "dx" || !subPage?.conduitFillDraft?.cfg) return;
    setCfg(normalizeDxCfg(subPage.conduitFillDraft.cfg));
  }, [subPage]);

  return (
    <UnitEditorPage
      type="dx"
      comps={visibleComponents}
      title="DX Split / Heat Pump"
      badge="DX / HP"
      accent="#4338CA"
      accentBg="#EEF2FF"
      accentBorder="#A5B4FC"
      defaultTag="DX"
      defaultLocation="Split system / heat pump"
      defaultInstallType={quoteDefault}
      pageKey="dx"
      flowKind="dx"
      cfg={cfg}
      buildDefaultSelected={(comps, activeCfg) =>
        buildDefaultDxSelected(activeCfg, { components: comps })
      }
      normalizeSelected={(selected, comps, activeCfg) =>
        reconcileDxSelected(selected, activeCfg, { components: comps })
      }
      reconcileSelected={(selected, comps, activeCfg) =>
        reconcileDxSelected(selected, activeCfg, { components: comps })
      }
    />
  );
}
