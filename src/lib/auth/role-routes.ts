import type { UserRole } from "@/types/database";

export function roleHome(role?: UserRole | string | null) {
  if (role === "admin") return "/admin";
  if (role === "pm" || role === "lead") return "/pm";
  if (role === "installer") return "/installer";
  if (role === "ops_manager") return "/ops";
  return "/customer";
}
