"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/role-routes";

async function signInAsRole(role: "admin" | "pm" | "customer") {
  const credentials = {
    admin:    { email: "demo-admin@trimrespond.com",    password: process.env.DEMO_ADMIN_PASSWORD! },
    pm:       { email: "demo-pm1@trimrespond.com",      password: process.env.DEMO_PM_PASSWORD! },
    customer: { email: "demo-customer@trimrespond.com", password: process.env.DEMO_CUSTOMER_PASSWORD! },
  }[role];

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(error.message);

  redirect(roleHome(role === "admin" ? "admin" : role === "pm" ? "pm" : "customer"));
}

export const signInAsAdmin    = signInAsRole.bind(null, "admin");
export const signInAsPm       = signInAsRole.bind(null, "pm");
export const signInAsCustomer = signInAsRole.bind(null, "customer");
