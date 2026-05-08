export const fmt$ = n => "$" + Math.round(n || 0).toLocaleString();
export const fmtHr = n => (n || 0).toFixed(1) + "h";
export const uid = () => crypto.randomUUID();