import { ahuTree } from "./ahuTree.js";
import { vavTree } from "./vavTree.js";
import { fcuTree } from "./fcuTree.js";
import { vrfTree } from "./vrfTree.js";
import { rtuTree } from "./rtuTree.js";
import { dxTree } from "./dxTree.js";
import { uhTree } from "./uhTree.js";
import { centralPlantTree } from "./centralPlantTree.js";
import { monitoringOnlyTree } from "./monitoringOnlyTree.js";
import { networkTree } from "./networkTree.js";

// Add future systems here by creating a new <system>Tree.js file
// and including it in this registry.
export const WIZARD_SYSTEMS = [
  ahuTree,
  vavTree,
  fcuTree,
  vrfTree,
  rtuTree,
  dxTree,
  uhTree,
  centralPlantTree,
  monitoringOnlyTree,
  networkTree,
];
