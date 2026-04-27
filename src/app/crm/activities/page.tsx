"use client";

import { useState, useEffect } from "react";
import type { CrmActivity } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { ActivityLog } from "@/components/crm/activity-log";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("admin");

  useEffect(() => {
    fetch("/api/crm/activities?limit=100")
      .then((r) => r.json())
      .then((json) => {
        setActivities(json.activities ?? []);
        if (json.activities) setRole("admin"); // if accessible, is admin/ops
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <CrmSubnav role={role} />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Activity Feed</h1>
        <p className="text-sm text-text-tertiary">All logged customer touchpoints, newest first.</p>
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm text-text-tertiary">Loading…</p>
      ) : (
        <ActivityLog
          activities={activities}
          showAccount
          showOpportunity
          emptyMessage="No activities logged yet. Start by opening an account and logging a call or meeting."
        />
      )}
    </div>
  );
}
