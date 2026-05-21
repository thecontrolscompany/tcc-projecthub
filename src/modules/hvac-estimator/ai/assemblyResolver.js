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
  { id: "50001", aliases: ["small controller xfmr", "small enclosure controller xfmr", "field mount controller xfmr", "controller with ups"] },
  { id: "50002", aliases: ["average controller xfmr", "average enclosure controller xfmr", "controller enclosure average", "medium controller xfmr"] },
  { id: "50003", aliases: ["large controller xfmr", "large enclosure controller xfmr", "controller enclosure large"] },
  { id: "60032", aliases: ["temp sensor room bacnet", "room temp sensor bacnet", "zone temperature sensor", "room temperature sensor", "wall temperature sensor"] },
  { id: "60059", aliases: ["dp switch air", "air dp switch", "differential pressure switch", "filter dp switch"] },
  { id: "60071", aliases: ["general relay", "command relay", "status relay", "control relay", "relay"] },
  { id: "60077", aliases: ["valve actuator", "control valve actuator", "heating coil control valve", "bypass control valve"] },
  { id: "60079", aliases: ["zone valve actuator", "zone valve act", "zone valve actuator and valve"] },
  { id: "60080", aliases: ["transformer", "general transformer", "panel mounted transformer", "xfmr"] },
  { id: "60152", aliases: ["insertion flow meter", "flow meter", "water flow meter"] },
  { id: "60163", aliases: ["temp sensor room net stat", "room temp sensor", "zone temp sensor", "stat sensor"] },
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

function scoreCandidate(candidate, sourceTokens, sourceText) {
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

function resolveControllerPanel(sourceTokens, sourceText) {
  if (!sourceTokens.includes("controller") && !sourceTokens.includes("panel") && !sourceTokens.includes("xfmr") && !sourceTokens.includes("transformer")) {
    return null;
  }

  if (sourceTokens.includes("large")) return ASSEMBLIES["50003"] || null;
  if (sourceTokens.includes("average")) return ASSEMBLIES["50002"] || null;
  return ASSEMBLIES["50001"] || null;
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
    return Boolean(candidateText) && (candidateText.includes(name) || name.includes(candidateText) || candidateText.includes(source) || source.includes(candidateText));
  });
  if (exactTokenMatch) return exactTokenMatch;

  return null;
}

export function resolveAssemblyCatalogMatch({ assemblyRef = "", assemblyName = "", sourceText = "" } = {}) {
  const normalizedSource = normalizeAssemblyText([assemblyRef, assemblyName, sourceText].filter(Boolean).join(" "));
  const sourceTokens = tokenize(normalizedSource);
  if (!sourceTokens.length && !normalizedSource) return null;

  const exact = resolveExactAssembly(assemblyRef, assemblyName, sourceText);
  if (exact) {
    return {
      id: String(exact.id),
      name: String(exact.name || exact.desc || exact.id),
      matchedBy: "exact",
    };
  }

  const alias = resolveAliasAssembly(normalizedSource);
  if (alias) {
    return alias;
  }

  const controllerPanel = resolveControllerPanel(sourceTokens, normalizedSource);
  if (controllerPanel) {
    return {
      id: String(controllerPanel.id),
      name: String(controllerPanel.name || controllerPanel.desc || controllerPanel.id),
      matchedBy: "controller-panel",
    };
  }

  let best = null;
  for (const candidate of ASSEMBLY_ENTRIES) {
    const score = scoreCandidate(candidate, sourceTokens, normalizedSource);
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
