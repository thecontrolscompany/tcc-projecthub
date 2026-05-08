// Maps app navigation state to a help context key, then to a help file.

export const HELP_MAP = {
  "estimates":      { file: "tasks/create-estimate.md",       title: "Estimates" },
  "pricebook":      { file: "tasks/pricebook.md",             title: "Price Book" },
  "wizard":         { file: "tasks/add-equipment.md",         title: "System Wizard" },
  "conduit-fill":   { file: "tasks/conduit-fill.md",          title: "Conduit Fill" },
  "vav-editor":     { file: "systems/vav.md",                 title: "VAV System" },
  "ahu-editor":     { file: "systems/ahu.md",                 title: "AHU System" },
  "rtu-editor":     { file: "systems/rtu.md",                 title: "RTU System" },
  "fcu-editor":     { file: "systems/fcu.md",                 title: "FCU System" },
  "uh-editor":      { file: "systems/uh.md",                  title: "Unit Heater" },
  "dx-editor":      { file: "systems/dx.md",                  title: "DX / Heat Pump" },
  "vrf-editor":     { file: "systems/vrf.md",                 title: "VRF System" },
  "plant-editor":   { file: "systems/plant.md",               title: "Central Plant" },
  "network-editor": { file: "systems/network.md",             title: "Network" },
};

// Derives a help context key from current app navigation state.
export function getHelpContextKey(page, subPage) {
  if (subPage?.type) return `${subPage.type}-editor`;
  return page || "estimates";
}

export const HELP_NAV = [
  {
    label: "Getting Started",
    items: [
      { label: "Quick Start", file: "quick-start.md" },
    ],
  },
  {
    label: "Task Guides",
    items: [
      { label: "Estimates",        file: "tasks/create-estimate.md" },
      { label: "Project Settings", file: "tasks/edit-project-settings.md" },
      { label: "Add Equipment",    file: "tasks/add-equipment.md" },
      { label: "Conduit Fill",     file: "tasks/conduit-fill.md" },
      { label: "Pricing",          file: "tasks/refresh-pricing.md" },
      { label: "Proposal Export",  file: "tasks/export-proposal.md" },
      { label: "Internal Export",  file: "tasks/export-internal.md" },
      { label: "Price Book",       file: "tasks/pricebook.md" },
    ],
  },
  {
    label: "System Reference",
    items: [
      { label: "AHU",         file: "systems/ahu.md" },
      { label: "VAV",         file: "systems/vav.md" },
      { label: "FCU",         file: "systems/fcu.md" },
      { label: "RTU",         file: "systems/rtu.md" },
      { label: "DX / HP",     file: "systems/dx.md" },
      { label: "VRF",         file: "systems/vrf.md" },
      { label: "Unit Heater", file: "systems/uh.md" },
      { label: "Plant",       file: "systems/plant.md" },
      { label: "Network",     file: "systems/network.md" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Assembly Pricing",  file: "reference/assembly-pricing.md" },
      { label: "Defaults",          file: "reference/how-defaults-work.md" },
      { label: "Price Snapshots",   file: "reference/price-snapshots.md" },
      { label: "Conduit Fill Rules", file: "reference/conduit-fill-rules.md" },
      { label: "Assumptions",       file: "reference/assumptions.md" },
    ],
  },
];
