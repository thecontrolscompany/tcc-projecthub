import { calcAssembly, ASSEMBLIES } from "./assemblyData.js";

export const getAssemblyAid = (entry, installType) => {
  const aid = installType === "EMT"
    ? (entry.emtAID ?? entry.plnAID)
    : (entry.plnAID ?? entry.emtAID);
  return aid == null ? "" : String(aid);
};

export const getCustomCost = (comp, installType) => {
  const aid = getAssemblyAid(comp, installType);
  if (aid) return calcAssembly(aid);
  return {
    mtl: (comp.unitMtl || 0) + (comp.extraMtl || 0),
    lbr: (comp.unitLbr || 0) + (comp.extraLbr || 0),
  };
};

export const toAllAssemblyOptions = (installType = "EMT") => {
  // Group by name — duplicate-named assemblies are EMT/Plenum pairs.
  // EBT convention: lower numeric ID = Plenum, higher = EMT.
  const byName = {};
  Object.values(ASSEMBLIES)
    .filter(asm => asm.name && !asm.name.startsWith("?_") && !asm.name.startsWith("_"))
    .forEach(asm => { (byName[asm.name] = byName[asm.name] || []).push(asm.id); });

  return Object.entries(byName)
    .map(([name, ids]) => {
      let chosenId;
      if (ids.length === 1) {
        chosenId = ids[0];
      } else {
        const sorted = [...ids].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        chosenId = installType === "EMT" ? sorted[sorted.length - 1] : sorted[0];
      }
      return { label: name, emtAID: chosenId, plnAID: chosenId, cat: "Assembly" };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const toAssemblyOptions = (comps = []) => {
  const seen = new Set();
  return comps.reduce((list, comp) => {
    if (!comp?.name || (!comp.emtAID && !comp.plnAID)) return list;
    const key = `${comp.name}|${comp.emtAID || ""}|${comp.plnAID || ""}`;
    if (seen.has(key)) return list;
    seen.add(key);
    list.push({
      label: comp.name,
      emtAID: comp.emtAID,
      plnAID: comp.plnAID,
      cat: comp.cat || "Custom",
    });
    return list;
  }, []);
};
