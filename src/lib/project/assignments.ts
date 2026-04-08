import type { ProjectAssignmentRole } from "@/types/database";
import type {
  ProjectAssignmentDraft,
  ProjectContactOption,
  TeamMemberOption,
} from "@/components/project-modal";

export type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string;
  role: ProjectAssignmentRole;
};

type AssignmentBase = {
  profile_id: string | null;
  pm_directory_id: string | null;
  role_on_project: ProjectAssignmentRole;
};

type ProjectBase = {
  pm_id: string | null;
  pm_directory_id: string | null;
  project_assignments: AssignmentBase[];
};

/**
 * Builds a deduplicated, sorted list of team member options from profiles and pm_directory contacts.
 * Used to populate the assignment dropdown in the project editor modal.
 */
export function buildTeamMemberOptions(
  profiles: ProfileOption[],
  contacts: ProjectContactOption[]
): TeamMemberOption[] {
  const byEmail = new Map<string, TeamMemberOption>();

  for (const profile of profiles) {
    const email = profile.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      id: `profile:${profile.id}`,
      email: profile.email,
      displayLabel: `${profile.full_name?.trim() || profile.email} (${profile.email})`,
      source: "profile",
      profileId: profile.id,
      pmDirectoryId: contacts.find((c) => c.email.toLowerCase() === email)?.id ?? null,
    });
  }

  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    if (!email || !email.endsWith("@controlsco.net") || contact.profile_id) continue;
    if (byEmail.has(email)) continue;
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
    byEmail.set(email, {
      id: `directory:${contact.id}`,
      email: contact.email,
      displayLabel: `${fullName || contact.email} (${contact.email}) - not yet signed in`,
      source: "directory",
      profileId: null,
      pmDirectoryId: contact.id,
    });
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel)
  );
}

/**
 * Converts a project's existing assignments into ProjectAssignmentDraft form for the editor modal.
 * Falls back to pm_id/pm_directory_id if no assignments exist.
 */
export function buildAssignmentDrafts(
  project: ProjectBase,
  teamOptions: TeamMemberOption[]
): ProjectAssignmentDraft[] {
  const drafts = project.project_assignments
    .map((a): ProjectAssignmentDraft | null => {
      const personId = a.profile_id
        ? `profile:${a.profile_id}`
        : a.pm_directory_id
          ? `directory:${a.pm_directory_id}`
          : "";
      if (!personId) return null;
      return { personId, roleOnProject: a.role_on_project };
    })
    .filter((d): d is ProjectAssignmentDraft => d !== null);

  if (drafts.length > 0) return drafts;

  const fallbackPm = project.pm_id
    ? `profile:${project.pm_id}`
    : project.pm_directory_id
      ? `directory:${project.pm_directory_id}`
      : "";

  if (fallbackPm && teamOptions.some((o) => o.id === fallbackPm)) {
    return [{ personId: fallbackPm, roleOnProject: "pm" as const }];
  }

  return [];
}

/**
 * Resolves a PM display name from an assignment row.
 * Priority: profile.full_name → pm_directory name → email fallbacks.
 */
export function resolvePmName(assignment: {
  profile?: { full_name?: string | null; email?: string | null } | null;
  pm_directory?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
} | null | undefined): string | null {
  if (!assignment) return null;
  const fullName = assignment.profile?.full_name;
  const dirName = [assignment.pm_directory?.first_name, assignment.pm_directory?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || dirName || assignment.profile?.email || assignment.pm_directory?.email || null;
}
