// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = { from: (table: string) => any };

/**
 * Auto-links the user's profile to any pm_directory rows that share their email
 * (only rows not yet linked). Then returns the IDs of all pm_directory rows
 * linked to this user's profile.
 *
 * Called on every authenticated page load — the update is a no-op once linked.
 */
export async function linkAndGetPmDirectoryIds(
  adminClient: AnySupabaseClient,
  user: { id: string; email?: string | null }
): Promise<string[]> {
  if (user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();
    await adminClient
      .from("pm_directory")
      .update({ profile_id: user.id })
      .eq("email", normalizedEmail)
      .is("profile_id", null);
  }

  const { data: rows } = await adminClient
    .from("pm_directory")
    .select("id")
    .eq("profile_id", user.id);

  return ((rows ?? []) as Array<{ id: string }>).map((row) => row.id);
}
