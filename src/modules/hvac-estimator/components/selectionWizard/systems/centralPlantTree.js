import { centralCoolingTree } from "./centralCoolingTree.js";
import { centralHeatingTree } from "./centralHeatingTree.js";
import { centralPlantG36Tree } from "./centralPlantG36Tree.js";
import { simpleCentralPlantTree } from "./simpleCentralPlantTree.js";

export const centralPlantTree = {
  id: "central-plant",
  label: "Central Plant",
  abbr: "CP",
  color: "#0284C7",
  description: "Central cooling, central heating, and combined plant applications.",
  systemType: "central-plant",
  configurations: [
    { id: "cooling", label: "Central Cooling", description: "Chiller plant with cooling towers, condenser water, and chilled water distribution" },
    { id: "cooling-opt", label: "Central Cooling with Optimization", description: "Chiller plant with advanced chiller sequencing and optimization sequences" },
    { id: "heating", label: "Central Heating", description: "Boiler plant with staged heating and hot water distribution pumps" },
    { id: "simple", label: "Simple Central Plant", description: "Combined HW and CHW plant — simplified single-loop configuration" },
    { id: "cooling-g36", label: "Central Cooling (Guideline 36)", hidden: true },
    { id: "heating-g36", label: "Central Heating (Guideline 36)", hidden: true },
  ],
  mechanicalTreesByConfig: {
    "cooling-opt": centralCoolingTree.mechanicalTreesByConfig.optimized,
    heating: centralHeatingTree.mechanicalTree,
    simple: simpleCentralPlantTree.mechanicalTree,
    "cooling-g36": centralPlantG36Tree.mechanicalTree,
    "heating-g36": centralPlantG36Tree.mechanicalTreesByConfig["heating-g36"],
  },
  mechanicalTree: centralCoolingTree.mechanicalTree,
};
