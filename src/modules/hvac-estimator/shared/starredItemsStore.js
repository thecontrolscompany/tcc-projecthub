const KEY = "tcc_starred_items";

export const loadStarred = () =>
  JSON.parse(localStorage.getItem(KEY) || "[]");

export const saveStarred = (ids) =>
  localStorage.setItem(KEY, JSON.stringify(ids));
