import { ASSEMBLIES } from "../shared/assemblyData.js";

const ASSEMBLY_ENTRIES = Object.values(ASSEMBLIES).filter((entry) => entry && typeof entry === "object");
const DEFAULT_WEIGHTS = new Map([
  ["controller", 2.5],
  ["control", 1.5],
  ["panel", 2.25],
  ["xfmr", 2.75],
  ["transformer", 2.75],
  ["relay", 3.25],
  ["valve", 3.25],
  ["actuator", 3.25],
  ["sensor", 3],
  ["temp", 2.75],
  ["temperature", 2.75],
  ["flow", 3.5],
  ["meter", 3.5],
  ["bacnet", 2.5],
  ["enclosure", 2.5],
  ["duct", 2.25],
  ["pressure", 2.75],
  ["transducer", 3.25],
  ["switch", 2.5],
]);

const ASSEMBLY_ALIASES = [
  // Controllers — VAV/VMA specific (60092 EMT / 60036 Plenum)
  { id: "60092", aliases: ["vav controller", "vma controller", "vav vma controller", "vav controller package", "vav ddc controller", "cvm controller", "vma ddc controller", "vav unit controller"] },
  // Controllers — FCU specific (60090 EMT / 60034 Plenum)
  { id: "60090", aliases: ["fcu controller", "fan coil controller", "fcu ddc controller", "fan coil unit controller", "fcu unit controller"] },
  { id: "60034", aliases: ["fcu controller package", "vav dxr controller", "dxr equipment controller", "dxr controller package"] },
  // Controllers / enclosures — small to average (AHU panel, BAS panel, field enclosure)
  { id: "60087", aliases: ["small controller xfmr", "small enclosure controller xfmr", "field mount controller xfmr", "controller with ups", "enclosure small controller xfmr", "average controller xfmr", "average enclosure controller xfmr", "controller enclosure average", "medium controller xfmr", "enclosure average controller xfmr", "pxc control panel", "ahu control panel", "bas control panel", "pxc panel"] },
  // Controllers / enclosures — large
  { id: "60095", aliases: ["large controller xfmr", "large enclosure controller xfmr", "controller enclosure large", "enclosure large controller xfmr"] },
  // Temperature sensors — room
  { id: "60032", aliases: ["temp sensor room bacnet", "room temp sensor bacnet", "zone temperature sensor", "room temperature sensor", "wall temperature sensor", "space temperature sensor", "space temp sensor"] },
  { id: "60163", aliases: ["temp sensor room net stat", "room temp sensor", "zone temp sensor", "stat sensor"] },
  // Temperature sensors — VAV/FCU discharge air (60093 EMT / 60037 Plenum)
  { id: "60093", aliases: ["discharge air temp", "discharge air temperature sensor", "da temp sensor", "vav discharge air temp", "fcu discharge air temp", "vav da temp", "supply air temp sensor unit"] },
  // Humidity + temp — keep ahead of duct-temp aliases so temp/RH phrases win.
  { id: "60064", aliases: ["humtemp duct", "hum temp duct", "duct temp humidity", "duct humidity temp", "ra temp rh", "ra temp humidity", "ra duct temp humidity", "temp rh duct", "duct temp rh sensor", "humidity duct"] },
  // Temperature sensors — duct (AHU/RTU applications; NOT for VAV/FCU discharge air)
  { id: "60073", aliases: ["duct temp", "temp sensor duct", "duct temperature sensor", "leaving air temp", "sa duct temp", "oa duct temp", "preheat leaving air temp", "cooling leaving air temp", "reheat leaving air temp", "duct temperature"] },
  { id: "60075", aliases: ["avg temp sensor", "averaging temp sensor", "averaging element", "mixed air temp", "ma temp", "return air temp sensor"] },
  { id: "60078", aliases: ["well temp sensor", "welltmpsensor", "temp sensor immersion", "immersion temperature sensor", "immersion temp", "hwr immersion temp", "chwr immersion temp", "hot water immersion", "chilled water immersion"] },
  { id: "60076", aliases: ["well temp sensor short", "immersion temp short run"] },
  { id: "60065", aliases: ["humtemp room", "hum temp room", "room temp humidity", "space temp rh"] },
  // Pressure — air
  { id: "60059", aliases: ["dp switch air", "air dp switch", "differential pressure switch", "filter dp switch", "dp switch filter", "filter differential pressure switch"] },
  { id: "60060", aliases: ["dp transducer air", "pressure sensor air", "static pressure sensor", "duct static pressure", "differential pressure air", "air differential pressure", "air pressure sensor", "duct dp sensor", "da static pressure", "sa static pressure", "discharge dp", "low suction dp", "pre filter dp", "final filter dp", "filter dp transmitter", "oa filter dp", "filter dp sensor"] },
  // Pressure — water
  { id: "60100", aliases: ["diff pressure water", "differential pressure water", "pressure sensor water", "chws dp sensor", "hws dp sensor", "building dp sensor", "campus dp sensor", "chws chwr dp", "hws hwr dp", "water differential pressure"] },
  // Air flow
  { id: "60057", aliases: ["air flow stn", "air flow station", "afms", "airflow measurement station", "oa air flow measurement", "airflow station"] },
  // Water flow
  { id: "60152", aliases: ["insertion flow meter", "flow meter", "water flow meter"] },
  // Valve actuators — reheat coil (VAV/FCU, 60081 EMT / 60033 Plenum)
  { id: "60081", aliases: ["reheat valve", "heating coil control valve", "vav reheat valve", "hot water reheat valve", "hw reheat valve", "proportional reheat valve", "modulating reheat valve", "hw heating coil valve", "reheat valve actuator", "fcu heating valve"] },
  // Valve actuators — cooling tower bypass
  { id: "60115", aliases: ["cooling tower bypass valve", "ct bypass valve", "tower bypass valve", "cooling tower bypass"] },
  // Valve actuators — generic (AHU coils, bypass, PICV, plant-level)
  { id: "60077", aliases: ["valve actuator", "valveactuator", "control valve actuator", "bypass control valve", "picv control", "2 way valve", "2way valve", "hot water valve", "cooling valve", "heating valve", "preheat valve", "chw valve", "hw bypass valve", "ahu heating valve", "ahu cooling valve"] },
  { id: "60079", aliases: ["zone valve actuator", "zone valve act", "zone valve actuator and valve"] },
  // Damper actuators
  { id: "60069", aliases: ["dmpr actuator", "damper actuator", "modulating damper actuator", "motorized damper actuator", "2 position damper", "damper open close", "oa damper", "ra damper actuator", "sa damper actuator", "gravity ventilator damper"] },
  { id: "60068", aliases: ["dmpr act end sw", "damper actuator end switch", "dmprActEndSw"] },
  // Relays
  { id: "60070", aliases: ["relay"] },
  { id: "60071", aliases: ["general relay", "command relay", "status relay", "control relay", "condensate alarm", "drain pan status", "uv status", "vfd hoa status", "smoke damper feedback"] },
  // Fan start/stop
  { id: "60047", aliases: ["ef start stop status plenum", "exhaust fan start stop status plenum"] },
  { id: "60137", aliases: ["ef start stop status", "ef start stop status emt", "exhaust fan start stop", "exhaust fan start stop status", "fan start stop status", "supply fan start stop", "fan start stop"] },
  // VSD / VFD
  { id: "60129", aliases: ["vsd start stop status speed", "vfd integration bacnet", "vfd bacnet", "vsd bacnet", "vfd integration", "vsd integration", "supply fan vfd", "chwp vfd", "hwp vfd", "pump vfd bacnet", "pump vfd integration"] },
  // Pump
  { id: "60131", aliases: ["pump start stop status", "pump controller", "pump status", "pump start stop"] },
  // Interlock
  { id: "60123", aliases: ["hardwire interlock", "interlock relay", "interlock wiring", "smoke damper interlock relay", "smoke damper interlock"] },
  // Current switch / fan or motor proof
  { id: "60061", aliases: ["zone current switch relay", "current switch relay", "fan current switch", "motor current switch", "current switch status", "current switch proof", "current switch with relay"] },
  // Control / status monitoring (PBO devices, BACnet third-party integrations)
  { id: "60122", aliases: ["control status", "status monitoring", "di monitoring", "status point", "pbo status", "bacnet integration", "system controller integration", "unit controller integration", "heater controller integration", "pump controller integration", "system integration bacnet", "lighting control integration", "gas detection integration", "electric meter integration", "dhw system integration", "energy valve integration", "belimo energy valve"] },
  // Transformer
  { id: "60080", aliases: ["transformer", "general transformer", "panel mounted transformer", "xfmr", "general xmfr", "fire smoke damper transformer", "smoke damper transformer", "fsd transformer"] },
].map((entry) => ({
  ...entry,
  normalizedAliases: entry.aliases.map((alias) => normalizeAssemblyText(alias)).filter(Boolean),
}));

function normalizeAssemblyText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeAssemblyText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && token.length > 1 && !["and", "for", "with", "the", "of", "to", "or"].includes(token));
}

function scoreCandidate(candidate, sourceTokens, sourceText, contextTokens = []) {
  const candidateText = normalizeAssemblyText(`${candidate.name || ""} ${candidate.desc || ""}`);
  if (!candidateText) return 0;

  if (sourceText === candidateText) return 100;
  if (sourceText.includes(candidateText) || candidateText.includes(sourceText)) return 60;

  let score = 0;
  const candidateTokens = tokenize(candidateText);
  const candidateTokenSet = new Set(candidateTokens);
  for (const token of sourceTokens) {
    if (!candidateTokenSet.has(token)) continue;
    score += DEFAULT_WEIGHTS.get(token) || 1;
  }
  const sourceTokenSet = new Set(sourceTokens);
  for (const token of contextTokens) {
    if (sourceTokenSet.has(token) || !candidateTokenSet.has(token)) continue;
    score += (DEFAULT_WEIGHTS.get(token) || 1) * 0.5;
  }

  if (candidateTokens.includes("controller") && candidateTokens.includes("xfmr")) {
    if (sourceTokens.includes("ups")) score += 1.25;
    if (sourceTokens.includes("enclosure")) score += 0.5;
  }

  if (candidateTokens.includes("relay") && sourceTokens.includes("command")) score += 0.75;
  if (candidateTokens.includes("relay") && sourceTokens.includes("status")) score += 0.75;
  if (candidateTokens.includes("sensor") && sourceTokens.includes("room")) score += 0.5;
  if (candidateTokens.includes("sensor") && sourceTokens.includes("zone")) score += 0.5;
  if (candidateTokens.includes("flow") && sourceTokens.includes("meter")) score += 1.25;
  if (candidateTokens.includes("valve") && sourceTokens.includes("actuator")) score += 1.25;

  return score;
}

function resolveAliasAssembly(sourceText) {
  const normalizedSource = normalizeAssemblyText(sourceText);
  if (!normalizedSource) return null;

  for (const entry of ASSEMBLY_ALIASES) {
    if (entry.normalizedAliases.some((alias) => normalizedSource === alias || normalizedSource.includes(alias) || alias.includes(normalizedSource))) {
      const match = ASSEMBLIES[entry.id];
      if (match) {
        return {
          id: String(match.id),
          name: String(match.name || match.desc || match.id),
          matchedBy: `alias:${entry.normalizedAliases.find((alias) => normalizedSource === alias || normalizedSource.includes(alias) || alias.includes(normalizedSource))}`,
        };
      }
    }
  }

  return null;
}

function resolveControllerPanel(sourceTokens) {
  if (!sourceTokens.includes("controller") && !sourceTokens.includes("panel") && !sourceTokens.includes("xfmr") && !sourceTokens.includes("transformer")) {
    return null;
  }

  if (sourceTokens.includes("large")) return ASSEMBLIES["60095"] || null;
  return ASSEMBLIES["60087"] || null;
}

function resolveExactAssembly(assemblyRef, assemblyName, sourceText) {
  const ref = normalizeAssemblyText(assemblyRef);
  const name = normalizeAssemblyText(assemblyName);
  const source = normalizeAssemblyText(sourceText);

  if (assemblyRef && ASSEMBLIES[assemblyRef]) {
    return ASSEMBLIES[assemblyRef];
  }

  if (!ref && !name && !source) return null;

  const exactNameMatch = ASSEMBLY_ENTRIES.find((entry) => {
    const candidateText = normalizeAssemblyText(`${entry.name || ""} ${entry.desc || ""}`);
    return candidateText === name || candidateText === source;
  });
  if (exactNameMatch) return exactNameMatch;

  const exactTokenMatch = ASSEMBLY_ENTRIES.find((entry) => {
    const candidateText = normalizeAssemblyText(`${entry.name || ""} ${entry.desc || ""}`);
    const matchesName = Boolean(name) && (candidateText.includes(name) || name.includes(candidateText));
    const matchesSource = Boolean(source) && (candidateText.includes(source) || source.includes(candidateText));
    return Boolean(candidateText) && (matchesName || matchesSource);
  });
  if (exactTokenMatch) return exactTokenMatch;

  return null;
}

export function resolveAssemblyCatalogMatch({ assemblyRef = "", assemblyName = "", sourceText = "", contextText = "" } = {}) {
  const normalizedSource = normalizeAssemblyText([assemblyRef, assemblyName, sourceText].filter(Boolean).join(" "));
  const sourceTokens = tokenize(normalizedSource);
  const normalizedContext = normalizeAssemblyText(contextText);
  const contextTokens = tokenize(normalizedContext);
  if (!sourceTokens.length && !normalizedSource && !contextTokens.length) return null;

  const exact = resolveExactAssembly(assemblyRef, assemblyName, sourceText);
  if (exact) {
    return {
      id: String(exact.id),
      name: String(exact.name || exact.desc || exact.id),
      matchedBy: "exact",
    };
  }

  const alias = resolveAliasAssembly(normalizedSource)
    || resolveAliasAssembly([normalizedSource, normalizedContext].filter(Boolean).join(" "));
  if (alias) {
    return alias;
  }

  const controllerPanel = resolveControllerPanel(sourceTokens);
  if (controllerPanel) {
    return {
      id: String(controllerPanel.id),
      name: String(controllerPanel.name || controllerPanel.desc || controllerPanel.id),
      matchedBy: "controller-panel",
    };
  }

  let best = null;
  for (const candidate of ASSEMBLY_ENTRIES) {
    const score = scoreCandidate(candidate, sourceTokens, normalizedSource, contextTokens);
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  if (!best || best.score < 3) return null;

  return {
    id: String(best.candidate.id),
    name: String(best.candidate.name || best.candidate.desc || best.candidate.id),
    matchedBy: `fuzzy:${best.score.toFixed(2)}`,
  };
}

export function describeAssemblyResolution(match, sourceAssemblyName = "", sourceAssemblyRef = "") {
  const parts = [];
  if (sourceAssemblyName) parts.push(`AI assembly: ${sourceAssemblyName}`);
  if (sourceAssemblyRef && sourceAssemblyRef !== match?.id) parts.push(`AI ref: ${sourceAssemblyRef}`);
  if (match?.id) parts.push(`Mapped to catalog assembly ${match.name} (${match.id})`);
  if (match?.matchedBy?.startsWith("alias:")) parts.push(`Matched by catalog alias ${match.matchedBy.slice(6)}`);
  if (!match?.id) parts.push("Unmapped assembly candidate");
  return parts.join(" · ");
}
