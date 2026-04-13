import { randomUUID } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const DEFAULT_BASE_URL = "https://rest.tsheets.com/api/v1";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type QuickBooksUserUpsert = {
  qb_user_id: number;
  email: string | null;
  username: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  payroll_id: string | null;
  active: boolean;
  group_id: number | null;
  last_active_at: string | null;
  last_modified_at: string | null;
  raw_json: Json;
  last_synced_at: string;
};

type QuickBooksJobcodeUpsert = {
  qb_jobcode_id: number;
  parent_qb_jobcode_id: number | null;
  name: string;
  type: string | null;
  active: boolean;
  assigned_to_all: boolean;
  billable: boolean;
  last_modified_at: string | null;
  raw_json: Json;
  last_synced_at: string;
};

type QuickBooksTimesheetUpsert = {
  qb_timesheet_id: number;
  qb_user_id: number;
  qb_jobcode_id: number | null;
  timesheet_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  state: string | null;
  entry_type: string | null;
  source: string | null;
  notes: string | null;
  customfields_json: Json | null;
  raw_json: Json;
  last_modified_at: string | null;
  last_synced_at: string;
};

interface IntegrationRunSummary {
  requested_days: number;
  start_date: string;
  users_imported?: number;
  jobcodes_imported?: number;
  timesheets_imported?: number;
}

export interface QuickBooksTimeConfig {
  enabled: boolean;
  baseUrl: string;
  accessTokenPresent: boolean;
}

export interface QuickBooksTimeImportResult {
  runId: string;
  usersImported: number;
  jobcodesImported: number;
  timesheetsImported: number;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAccessToken() {
  const token = process.env.QUICKBOOKS_TIME_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("QuickBooks Time access token is not configured.");
  }
  return token;
}

function getDateDaysAgo(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function parseIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  return value;
}

function getQuickBooksRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if ("id" in record) {
    return record;
  }

  const first = Object.values(record)[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  return first as Record<string, unknown>;
}

export function getQuickBooksTimeConfig(): QuickBooksTimeConfig {
  const baseUrl = process.env.QUICKBOOKS_TIME_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const accessToken = process.env.QUICKBOOKS_TIME_ACCESS_TOKEN?.trim();

  return {
    enabled: Boolean(accessToken),
    baseUrl,
    accessTokenPresent: Boolean(accessToken),
  };
}

async function fetchQuickBooksTime<T>(
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const token = getAccessToken();
  const config = getQuickBooksTimeConfig();
  const url = new URL(`${config.baseUrl}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QuickBooks Time request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  return (await response.json()) as T;
}

async function fetchQuickBooksTimePaginated(
  path: string,
  query: Record<string, string | number | undefined> = {}
) {
  let page = 1;
  const all: unknown[] = [];

  while (true) {
    const payload = await fetchQuickBooksTime<Record<string, unknown>>(path, {
      ...query,
      page,
      limit: 199,
    });

    all.push(...extractCollection(payload));

    if (!payload.more) {
      break;
    }

    page += 1;
  }

  return all;
}

export async function importQuickBooksTimeData(days = 30): Promise<QuickBooksTimeImportResult> {
  const supabase = adminClient();
  const startDate = getDateDaysAgo(days);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const runSummary: IntegrationRunSummary = {
    requested_days: days,
    start_date: startDate,
  };

  const { error: runError } = await supabase.from("integration_sync_runs").insert({
    id: runId,
    integration_target: "quickbooks_time",
    sync_type: "read_only_import",
    started_at: startedAt,
    status: "running",
    summary_json: runSummary,
  });

  if (runError) {
    throw runError;
  }

  try {
    const [users, jobcodes, timesheets] = await Promise.all([
      fetchQuickBooksTimePaginated("/users"),
      fetchQuickBooksTimePaginated("/jobcodes"),
      fetchQuickBooksTimePaginated("/timesheets", { start_date: startDate }),
    ]);

    const userRows = users
      .map((item) => mapQuickBooksUser(item))
      .filter((item): item is QuickBooksUserUpsert => item !== null);
    const jobcodeRows = jobcodes
      .map((item) => mapQuickBooksJobcode(item))
      .filter((item): item is QuickBooksJobcodeUpsert => item !== null);
    const timesheetRows = timesheets
      .map((item) => mapQuickBooksTimesheet(item))
      .filter((item): item is QuickBooksTimesheetUpsert => item !== null);

    if (userRows.length > 0) {
      const { error } = await supabase.from("qb_time_users").upsert(userRows, { onConflict: "qb_user_id" });
      if (error) throw error;
    }

    if (jobcodeRows.length > 0) {
      const { error } = await supabase.from("qb_time_jobcodes").upsert(jobcodeRows, { onConflict: "qb_jobcode_id" });
      if (error) throw error;
    }

    if (timesheetRows.length > 0) {
      const { error } = await supabase.from("qb_time_timesheets").upsert(timesheetRows, { onConflict: "qb_timesheet_id" });
      if (error) throw error;
    }

    runSummary.users_imported = userRows.length;
    runSummary.jobcodes_imported = jobcodeRows.length;
    runSummary.timesheets_imported = timesheetRows.length;

    await supabase
      .from("integration_sync_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary_json: runSummary,
      })
      .eq("id", runId);

    return {
      runId,
      usersImported: userRows.length,
      jobcodesImported: jobcodeRows.length,
      timesheetsImported: timesheetRows.length,
    };
  } catch (error) {
    await supabase
      .from("integration_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_json: {
          message: error instanceof Error ? error.message : "Unknown import error",
        },
      })
      .eq("id", runId);

    throw error;
  }
}

function extractCollection(value: unknown): unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const container = value as Record<string, unknown>;
  const data = container.results ?? container.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    return Object.values(data as Record<string, unknown>).flatMap((entry) => {
      if (Array.isArray(entry)) {
        return entry;
      }

      if (entry && typeof entry === "object") {
        return Object.values(entry as Record<string, unknown>);
      }

      return [];
    });
  }

  return [];
}

function mapQuickBooksUser(value: unknown) {
  const user = getQuickBooksRecord(value);
  if (!user) {
    return null;
  }

  const qbUserId = Number(user.id);
  if (!qbUserId) {
    return null;
  }

  return {
    qb_user_id: qbUserId,
    email: typeof user.email === "string" ? user.email : null,
    username: typeof user.username === "string" ? user.username : null,
    display_name: String(user.display_name ?? user.first_name ?? `QB User ${qbUserId}`),
    first_name: typeof user.first_name === "string" ? user.first_name : null,
    last_name: typeof user.last_name === "string" ? user.last_name : null,
    payroll_id: typeof user.payroll_id === "string" ? user.payroll_id : null,
    active: Boolean(user.active),
    group_id: typeof user.group_id === "number" ? user.group_id : null,
    last_active_at: parseIsoTimestamp(user.last_active),
    last_modified_at: parseIsoTimestamp(user.last_modified),
    raw_json: value as Json,
    last_synced_at: new Date().toISOString(),
  };
}

function mapQuickBooksJobcode(value: unknown) {
  const jobcode = getQuickBooksRecord(value);
  if (!jobcode) {
    return null;
  }

  const qbJobcodeId = Number(jobcode.id);
  if (!qbJobcodeId) {
    return null;
  }

  return {
    qb_jobcode_id: qbJobcodeId,
    parent_qb_jobcode_id: typeof jobcode.parent_id === "number" ? jobcode.parent_id : null,
    name: String(jobcode.name ?? `QB Jobcode ${qbJobcodeId}`),
    type: typeof jobcode.type === "string" ? jobcode.type : null,
    active: Boolean(jobcode.active),
    assigned_to_all: Boolean(jobcode.assigned_to_all),
    billable: Boolean(jobcode.billable),
    last_modified_at: parseIsoTimestamp(jobcode.last_modified),
    raw_json: value as Json,
    last_synced_at: new Date().toISOString(),
  };
}

function mapQuickBooksTimesheet(value: unknown) {
  const timesheet = getQuickBooksRecord(value);
  if (!timesheet) {
    return null;
  }

  const qbTimesheetId = Number(timesheet.id);
  const qbUserId = Number(timesheet.user_id);
  if (!qbTimesheetId || !qbUserId) {
    return null;
  }

  return {
    qb_timesheet_id: qbTimesheetId,
    qb_user_id: qbUserId,
    qb_jobcode_id: typeof timesheet.jobcode_id === "number" ? timesheet.jobcode_id : null,
    timesheet_date: String(timesheet.date ?? new Date().toISOString().slice(0, 10)),
    start_at: parseIsoTimestamp(timesheet.start),
    end_at: parseIsoTimestamp(timesheet.end),
    duration_seconds: typeof timesheet.duration === "number" ? timesheet.duration : null,
    state: typeof timesheet.state === "string" ? timesheet.state : null,
    entry_type: typeof timesheet.type === "string" ? timesheet.type : null,
    source: typeof timesheet.location === "string" ? timesheet.location : null,
    notes: typeof timesheet.notes === "string" ? timesheet.notes : null,
    customfields_json:
      timesheet.customfields && typeof timesheet.customfields === "object"
        ? (timesheet.customfields as Json)
        : null,
    raw_json: value as Json,
    last_modified_at: parseIsoTimestamp(timesheet.last_modified),
    last_synced_at: new Date().toISOString(),
  };
}
