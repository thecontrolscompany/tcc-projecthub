const KEY = "tcc_current_user";

export function setCurrentUser(account) {
  if (!account) return clearCurrentUser();
  const user = {
    name:
      account.name ||
      account.full_name ||
      account.user_metadata?.full_name ||
      account.username ||
      account.email ||
      "Unknown User",
    email: account.email || account.username || "",
    id: account.id || account.localAccountId || account.homeAccountId || "",
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    return user;
  }
  return user;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
