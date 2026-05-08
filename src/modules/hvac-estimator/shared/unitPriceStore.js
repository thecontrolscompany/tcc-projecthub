const KEY = "tcc_unit_prices";

export function loadUnitPrices() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveUnitPrices(overrides) {
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch(e) { console.error("UnitPrice save failed", e); }
}

export function resetUnitPrices() {
  localStorage.removeItem(KEY);
}