import { useState, useRef } from "react";
import { T } from "../../shared/tokens.js";
import { useIsMobile } from "../../shared/useIsMobile.js";
import { WIZARD_SYSTEMS } from "./selectionWizardData.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVisible(node, selections) {
  if (!node.showWhen) return true;
  const { itemId, value, notValue } = node.showWhen;
  const cur = selections[itemId];
  if (value    !== undefined) return cur === value;
  if (notValue !== undefined) return cur !== notValue;
  return true;
}

function isDisabled(item, selections) {
  if (!item.conflictsWithItem) return false;
  const other = selections[item.conflictsWithItem];
  const none  = item.conflictNoneValue ?? "none";
  return other !== undefined && other !== none;
}

function isEstimatingSection(section) {
  if (section.hidden) return false;
  return !section.scope || section.scope === "mechanical" || section.scope === "optional-hardware";
}

function getEstimatingSections(system) {
  return (system?.mechanicalTree ?? []).filter(isEstimatingSection);
}

function walkVisibleItems(items, selections, visitor, parents = []) {
  for (const item of items ?? []) {
    if (item.hidden) continue;
    if (!isVisible(item, selections)) continue;
    visitor(item, parents);
    if (item.type === "group") {
      walkVisibleItems(item.items, selections, visitor, [...parents, item.label]);
    }
  }
}

function resolveSystemForConfig(system, configId) {
  if (!system) return null;
  const mechanicalTree = system.mechanicalTreesByConfig?.[configId] ?? system.mechanicalTree;
  return mechanicalTree === system.mechanicalTree ? system : { ...system, mechanicalTree };
}

function getConfigOverrides(systemId, configId) {
  const o = {};
  if (systemId === "vav") {
    if (configId === "sd-parallel") o["box-fan-type-7"] = "parallel-single-speed-8";
    if (configId === "sd-series")   o["box-fan-type-7"] = "series-single-speed-68";
    if (configId === "dd")          o["box-fan-type-7"] = "none-0";
  }
  if (systemId === "ahu") {
    if (configId === "erv-wheel") o["hr-type-400"] = "enthalpy-wheel-420";
    if (configId === "erv-plate") o["hr-type-400"] = "air-to-air-heat-exchanger-441";
    if (configId === "erv-rac")   o["hr-type-400"] = "glycol-loop-430";
  }
  if (systemId === "vrf") {
    if (configId === "idu") o["vrf-role"] = "indoor-units";
    if (configId === "odu") o["vrf-role"] = "outdoor-unit";
  }
  if (systemId === "rtu") {
    if (configId === "heat-pump")  o["rtu-heat-type-900"] = "none-0";
    if (configId === "cool-only")  o["rtu-heat-type-900"] = "none-0";
    if (configId === "gas-heat")   o["rtu-heat-type-900"] = "staged-heating-910";
  }
  if (systemId === "dx") {
    if (configId === "heat-pump")    o["dx-mode-2"] = "heat-pump-mode";
    if (configId === "cooling-only") o["dx-mode-2"] = "cooling-only-mode";
    if (configId === "furnace")      o["dx-mode-2"] = "furnace-mode";
  }
  if (systemId === "uh") {
    if (configId === "hw-uh")   o["uh-heat-type-13"] = "hot-water-steam-20";
    if (configId === "elec-uh") o["uh-heat-type-13"] = "electric-staged-18";
    if (configId === "gas-uh")  o["uh-heat-type-13"] = "electric-staged-18";
    if (configId === "uv")      { o["uh-heat-type-13"] = "hot-water-steam-20"; o["uh-fan-type-3"] = "variable-speed-6"; }
  }
  return o;
}

function buildDefaults(system, configId) {
  if (!system) return {};
  const overrides = getConfigOverrides(system.id, configId);
  const defaults  = {};
  for (const section of getEstimatingSections(system)) {
    walkVisibleItems(section.items, defaults, item => {
      if (item.type === "radio") {
        defaults[item.id] = overrides[item.id] ?? item.defaultOption;
      } else if (item.type === "check") {
        defaults[item.id] = overrides[item.id] ?? item.defaultChecked;
      }
    });
  }
  return defaults;
}

function getVisibleSections(system, selections) {
  return getEstimatingSections(system).filter(s => isVisible(s, selections));
}

function buildSummaryLines(system, selections) {
  const lines = [];
  for (const section of getVisibleSections(system, selections)) {
    walkVisibleItems(section.items, selections, (item, parents) => {
      const val = selections[item.id];
      if (val === undefined || val === false) return;
      const itemLabel = parents.length > 0 ? `${parents.join(" / ")} / ${item.label}` : item.label;
      if (item.type === "radio") {
        const opt = item.options?.find(o => o.id === val);
        if (opt) lines.push({ section: section.label, label: itemLabel, value: opt.label });
      } else if (item.type === "check" && val === true) {
        lines.push({ section: section.label, label: itemLabel, value: "Yes" });
      }
    });
  }
  return lines;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, onStepClick }) {
  const steps = ["Select System", "Configure", "Review"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28, flexWrap: "wrap" }}>
      {steps.map((label, i) => {
        const n       = i + 1;
        const active  = n === step;
        const done    = n < step;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => done && onStepClick(n)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 12px", borderRadius: 6, border: "1px solid",
                borderColor: active ? T.blue : done ? T.border2 : T.border,
                background:  active ? T.blueFaint : "transparent",
                color:        active ? T.blue : done ? T.muted : T.dim,
                cursor:       done ? "pointer" : "default",
                fontFamily:  T.mono, fontSize: 12, fontWeight: active ? 700 : 400,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 11,
                background: active ? T.blue : done ? T.muted : T.faint,
                color: active || done ? "#fff" : T.dim, fontWeight: 700, flexShrink: 0,
              }}>
                {done ? "✓" : n}
              </span>
              {label}
            </button>
            {i < steps.length - 1 && (
              <span style={{ color: T.border2, fontFamily: T.mono, fontSize: 11, margin: "0 4px" }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ selectedSystemId, selectedConfigId, onSelectSystem, onSelectConfig, canAdvance, onAdvance }) {
  const system = WIZARD_SYSTEMS.find(s => s.id === selectedSystemId);
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: T.text }}>Select a System Type</h2>
      <p style={{ margin: "0 0 20px", color: T.muted, fontSize: 13, fontFamily: T.mono }}>
        Choose the type of HVAC or controls system you are estimating.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
        {WIZARD_SYSTEMS.map(sys => {
          const selected = sys.id === selectedSystemId;
          return (
            <button key={sys.id} onClick={() => onSelectSystem(sys.id)} style={{
              padding: "14px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              border: `2px solid ${selected ? sys.color : T.border}`,
              background: selected ? T.blueFaint : T.surface,
              boxShadow: selected ? `0 0 0 2px ${sys.color}22` : "none",
              transition: "border-color 0.1s",
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: T.mono, color: sys.color, marginBottom: 4 }}>
                {sys.abbr}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{sys.label}</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{sys.description}</div>
            </button>
          );
        })}
      </div>

      {system && system.configurations.filter(c => !c.hidden).length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: T.text }}>
            Select Configuration
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {system.configurations.filter(c => !c.hidden).map(cfg => {
              const sel = cfg.id === selectedConfigId;
              return (
                <button key={cfg.id} onClick={() => onSelectConfig(cfg.id)} style={{
                  padding: "16px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${sel ? system.color : T.border}`,
                  background: sel ? T.blueFaint : T.surface,
                  boxShadow: sel ? `0 0 0 2px ${system.color}22` : "none",
                  transition: "border-color 0.1s",
                }}>
                  <div style={{ fontSize: 14, fontWeight: sel ? 700 : 600, color: sel ? system.color : T.text, lineHeight: 1.3 }}>
                    {cfg.label}
                  </div>
                  {cfg.description && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
                      {cfg.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        disabled={!canAdvance} onClick={onAdvance}
        style={{
          padding: "10px 24px", borderRadius: 7, border: "none", cursor: canAdvance ? "pointer" : "default",
          background: canAdvance ? T.blue : T.faint,
          color: canAdvance ? "#fff" : T.dim,
          fontFamily: T.mono, fontSize: 13, fontWeight: 700,
        }}
      >
        Next: Configure →
      </button>
    </div>
  );
}

// ─── Step 2 Tree Components ────────────────────────────────────────────────────

function TreeItem({ item, selections, onChange }) {
  const visible  = isVisible(item, selections);
  const disabled = isDisabled(item, selections);
  if (!visible) return null;

  const baseRow = {
    display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0",
    opacity: disabled ? 0.4 : 1,
  };

  if (item.type === "check") {
    return (
      <label style={{ ...baseRow, cursor: disabled ? "default" : "pointer", alignItems: "center" }}>
        <input
          type="checkbox" disabled={disabled} checked={!!selections[item.id]}
          onChange={e => onChange(item.id, e.target.checked)}
          style={{ accentColor: T.blue, margin: 0, flexShrink: 0 }}
        />
        <span style={{ fontSize: 12, color: T.text }}>{item.label}</span>
      </label>
    );
  }

  if (item.type === "radio") {
    return (
      <div style={{ paddingBottom: 6 }}>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, fontWeight: 600, marginBottom: 5 }}>
          {item.label}
          {disabled && <span style={{ marginLeft: 8, color: T.dim, fontWeight: 400 }}>(unavailable)</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
          {item.options.map(opt => {
            const checked = selections[item.id] === opt.id;
            return (
              <label key={opt.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8, cursor: disabled ? "default" : "pointer",
                padding: "5px 8px", borderRadius: 5,
                background: checked ? T.blueFaint : "transparent",
                border: `1px solid ${checked ? T.blue : "transparent"}`,
              }}>
                <input
                  type="radio" disabled={disabled} checked={checked}
                  onChange={() => !disabled && onChange(item.id, opt.id)}
                  style={{ accentColor: T.blue, margin: "2px 0 0", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 12, color: checked ? T.blue : T.text, fontWeight: checked ? 600 : 400 }}>
                    {opt.label}
                  </div>
                  {opt.description && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
                      {opt.description}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === "group") {
    return (
      <div style={{
        margin: "6px 0 10px 10px",
        paddingLeft: 10,
        borderLeft: `2px solid ${T.border}`,
      }}>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, fontWeight: 600, marginBottom: 6 }}>
          {item.label}
        </div>
        {item.items?.map(child => (
          <TreeItem key={child.id} item={child} selections={selections} onChange={onChange} />
        ))}
      </div>
    );
  }

  return null;
}

function TreeSection({ section, selections, expanded, onToggle, onChange, sectionRef }) {
  if (!isVisible(section, selections)) return null;
  return (
    <div ref={sectionRef} style={{
      border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 10, overflow: "hidden",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", textAlign: "left", padding: "10px 14px",
        background: T.panel, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>
            {section.label}
          </span>
          {section.required && (
            <span style={{
              fontSize: 9, fontFamily: T.mono, background: "#FEF3C7", color: "#92400E",
              border: "1px solid #FDE68A", borderRadius: 4, padding: "1px 5px",
            }}>required</span>
          )}
          {section.note && (
            <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>{section.note}</span>
          )}
        </div>
        <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 14 }}>{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "10px 14px 12px", background: T.surface, borderTop: `1px solid ${T.border}` }}>
          {section.items.map(item => (
            <TreeItem key={item.id} item={item} selections={selections} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ system, config, selections, expandedSections, onToggleSection, onUpdate, onBack, onAdvance }) {
  const isMobile   = useIsMobile();
  const sectionRefs = useRef({});
  const contentRef  = useRef(null);

  function scrollTo(sectionId) {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleUpdate(itemId, value) {
    // Auto-clear conflicts (VAV box fan ↔ exhaust damper)
    const updates = { [itemId]: value };
    for (const section of getEstimatingSections(system)) {
      walkVisibleItems(section.items, selections, item => {
        if (item.conflictsWithItem === itemId && value !== (item.conflictNoneValue ?? "none")) {
          updates[item.id] = item.conflictNoneValue ?? "none";
        }
      });
    }
    for (const [k, v] of Object.entries(updates)) onUpdate(k, v);
  }

  const visibleSections = getVisibleSections(system, selections);
  const summaryLines    = buildSummaryLines(system, selections);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>Mechanical System Selection</h2>
        <span style={{
          fontSize: 11, fontFamily: T.mono, background: T.blueFaint, color: T.blue,
          border: `1px solid ${T.blueA18 ?? T.border}`, borderRadius: 4, padding: "2px 7px",
        }}>{system.abbr}</span>
        {config && (
          <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>{config.label}</span>
        )}
      </div>
      <p style={{ margin: "0 0 20px", color: T.muted, fontSize: 12, fontFamily: T.mono }}>
        Expand sections and make your selections. Some items are shown or hidden based on previous choices.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Left nav */}
        {!isMobile && (
          <div style={{
            width: 200, flexShrink: 0, position: "sticky", top: 16,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: 8, maxHeight: "70vh", overflowY: "auto",
          }}>
            <div style={{ fontSize: 10, fontFamily: T.mono, color: T.dim, padding: "4px 8px 8px", fontWeight: 600, letterSpacing: 1 }}>
              SECTIONS
            </div>
            {visibleSections.map(section => (
              <button key={section.id} onClick={() => scrollTo(section.id)} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "6px 10px", borderRadius: 5, border: "none",
                background: "transparent", color: T.muted, cursor: "pointer",
                fontSize: 11, fontFamily: T.mono,
              }}
                onMouseOver={e => e.currentTarget.style.background = T.panel}
                onMouseOut={e  => e.currentTarget.style.background = "transparent"}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}

        {/* Tree content */}
        <div ref={contentRef} style={{ flex: 1, minWidth: 0 }}>
          {visibleSections.map((section, i) => {
            const prev = visibleSections[i - 1];
            const showDivider =
              section.scope === "optional-hardware" &&
              (!prev || prev.scope !== "optional-hardware");
            return (
              <div key={section.id}>
                {showDivider && (
                  <div style={{
                    margin: "18px 0 10px",
                    fontSize: 11, fontFamily: T.mono, color: T.dim,
                    fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    borderTop: `1px solid ${T.border}`, paddingTop: 14,
                  }}>
                    Optional Sensors & Equipment
                  </div>
                )}
                <TreeSection
                  section={section}
                  selections={selections}
                  expanded={!!expandedSections[section.id]}
                  onToggle={() => onToggleSection(section.id)}
                  onChange={handleUpdate}
                  sectionRef={el => sectionRefs.current[section.id] = el}
                />
              </div>
            );
          })}
        </div>

        {/* Summary sidebar */}
        {!isMobile && (
          <div style={{
            width: 210, flexShrink: 0, position: "sticky", top: 16,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: 12, maxHeight: "70vh", overflowY: "auto",
          }}>
            <div style={{ fontSize: 10, fontFamily: T.mono, color: T.dim, marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
              CURRENT SELECTIONS
            </div>
            {summaryLines.length === 0 ? (
              <div style={{ fontSize: 11, color: T.dim, fontStyle: "italic" }}>No selections yet.</div>
            ) : (
              summaryLines.map((line, i) => (
                <div key={i} style={{ marginBottom: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
                  <div style={{ fontSize: 9, fontFamily: T.mono, color: T.dim, marginBottom: 1 }}>{line.section}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 1 }}>{line.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{line.value}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onBack} style={{
          padding: "9px 18px", borderRadius: 7, border: `1px solid ${T.border2}`,
          background: "none", color: T.muted, cursor: "pointer", fontFamily: T.mono, fontSize: 12,
        }}>
          ← Back
        </button>
        <button onClick={onAdvance} style={{
          padding: "9px 22px", borderRadius: 7, border: "none",
          background: T.blue, color: "#fff", cursor: "pointer", fontFamily: T.mono, fontSize: 13, fontWeight: 700,
        }}>
          Next: Review →
        </button>
      </div>
    </div>
  );
}

// ─── System → editor type mapping ─────────────────────────────────────────────

const SYSTEM_EDITOR_MAP = {
  "central-plant": "plant",
};

function getEditorType(systemId) {
  return SYSTEM_EDITOR_MAP[systemId] ?? systemId;
}

// Systems that have no direct UnitEditorPage (no schematic / hardware picker)
const SYSTEMS_WITHOUT_EDITOR = new Set(["monitoring-only"]);

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({ system, config, selections, onRestart, onAddToEstimate, hasActiveEstimate }) {
  const summaryLines = buildSummaryLines(system, selections);

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: T.text }}>Review Selection</h2>
      <p style={{ margin: "0 0 20px", color: T.muted, fontSize: 13, fontFamily: T.mono }}>
        Review your mechanical system selections before adding to an estimate.
      </p>

      {/* System card */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        background: T.surface, border: `2px solid ${system.color}`,
        borderRadius: 10, marginBottom: 20,
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: T.mono, color: system.color }}>{system.abbr}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{system.label}</div>
          {config && <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>{config.label}</div>}
        </div>
      </div>

      {/* Summary table */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
        overflow: "hidden", marginBottom: 24,
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          background: T.panel, borderBottom: `1px solid ${T.border}`,
          padding: "8px 14px",
        }}>
          {["Section", "Setting", "Selection"].map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: T.muted, letterSpacing: 1 }}>
              {h.toUpperCase()}
            </div>
          ))}
        </div>
        {summaryLines.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.dim, fontStyle: "italic" }}>No selections recorded.</div>
        ) : (
          summaryLines.map((line, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              padding: "7px 14px", borderBottom: `1px solid ${T.border}`,
              background: i % 2 === 0 ? "transparent" : T.panel,
            }}>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{line.section}</div>
              <div style={{ fontSize: 12, color: T.text }}>{line.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>{line.value}</div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      {(() => {
        const editorType = getEditorType(system.id);
        const hasEditor  = !SYSTEMS_WITHOUT_EDITOR.has(system.id);
        const canAdd     = hasEditor && !!onAddToEstimate;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              disabled={!canAdd}
              onClick={() => {
                if (!canAdd) return;
                try {
                  sessionStorage.setItem("wizard_launch_config", JSON.stringify({
                    systemId: system.id,
                    configId: config?.id,
                  }));
                } catch {}
                onAddToEstimate(editorType);
              }}
              style={{
                padding: "10px 22px", borderRadius: 7, border: "none",
                background: canAdd ? T.blue : T.faint,
                color: canAdd ? "#fff" : T.dim,
                cursor: canAdd ? "pointer" : "not-allowed",
                fontFamily: T.mono, fontSize: 13, fontWeight: 700,
              }}
            >
              + Add to Estimate
            </button>
            {canAdd && !hasActiveEstimate && (
              <span style={{ fontSize: 11, color: "#B45309", fontFamily: T.mono,
                background: "#FEF3C7", border: "1px solid #FDE68A",
                borderRadius: 5, padding: "5px 10px" }}>
                ⚠ No estimate is open — you'll be taken to the estimates list to open one first.
              </span>
            )}
            {!hasEditor && (
              <span style={{ fontSize: 11, color: T.dim, fontStyle: "italic", fontFamily: T.mono }}>
                No hardware editor for this system type.
              </span>
            )}
            <button onClick={onRestart} style={{
              marginLeft: "auto", padding: "6px 14px", borderRadius: 6,
              border: `1px solid ${T.border2}`, background: "none",
              color: T.muted, cursor: "pointer", fontFamily: T.mono, fontSize: 12,
            }}>
              ← Start Over
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SelectionWizardPage({ onAddToEstimate, hasActiveEstimate = false }) {
  const [step,            setStep]            = useState(1);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [selections,       setSelections]       = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const system = WIZARD_SYSTEMS.find(s => s.id === selectedSystemId);
  const activeSystem = resolveSystemForConfig(system, selectedConfigId);
  const config = system?.configurations.find(c => c.id === selectedConfigId);

  function selectSystem(systemId) {
    const sys = WIZARD_SYSTEMS.find(s => s.id === systemId);
    setSelectedSystemId(systemId);
    if (sys?.configurations.length === 1) {
      const cfgId = sys.configurations[0].id;
      const resolvedSys = resolveSystemForConfig(sys, cfgId);
      setSelectedConfigId(cfgId);
      setSelections(buildDefaults(resolvedSys, cfgId));
      initExpanded(resolvedSys);
    } else {
      setSelectedConfigId(null);
      setSelections({});
      setExpandedSections({});
    }
  }

  function selectConfig(configId) {
    const resolvedSystem = resolveSystemForConfig(system, configId);
    setSelectedConfigId(configId);
    setSelections(buildDefaults(resolvedSystem, configId));
    initExpanded(resolvedSystem);
  }

  function initExpanded(sys) {
    const expanded = {};
    for (const s of getEstimatingSections(sys)) expanded[s.id] = true;
    setExpandedSections(expanded);
  }

  function updateSelection(itemId, value) {
    setSelections(prev => ({ ...prev, [itemId]: value }));
  }

  function toggleSection(sectionId) {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  function restart() {
    setStep(1);
    setSelectedSystemId(null);
    setSelectedConfigId(null);
    setSelections({});
    setExpandedSections({});
  }

  const canAdvance = !!selectedSystemId && !!selectedConfigId;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px" }}>
        <StepIndicator
          step={step}
          onStepClick={n => n < step && setStep(n)}
        />

        {step === 1 && (
          <Step1
            selectedSystemId={selectedSystemId}
            selectedConfigId={selectedConfigId}
            onSelectSystem={selectSystem}
            onSelectConfig={selectConfig}
            canAdvance={canAdvance}
            onAdvance={() => setStep(2)}
          />
        )}

        {step === 2 && activeSystem && (
          <Step2
            system={activeSystem}
            config={config}
            selections={selections}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
            onUpdate={updateSelection}
            onBack={() => setStep(1)}
            onAdvance={() => setStep(3)}
          />
        )}

        {step === 3 && activeSystem && (
          <Step3
            system={activeSystem}
            config={config}
            selections={selections}
            onRestart={restart}
            onAddToEstimate={onAddToEstimate}
            hasActiveEstimate={hasActiveEstimate}
          />
        )}
      </div>
    </div>
  );
}
