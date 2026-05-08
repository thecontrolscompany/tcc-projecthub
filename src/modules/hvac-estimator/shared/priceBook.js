const KEY = "tcc_pricebook";

export function loadPriceBook() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function savePriceBook(book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch(e) { console.error("PriceBook save failed", e); }
}

export function getPrice(book, id, field, defaultVal) {
  return book[id]?.[field] ?? defaultVal;
}