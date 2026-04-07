"use client";

import { useState } from "react";

type DebugAssignment = {
  role_on_project?: string | null;
  is_primary?: boolean | null;
  profile_id?: string | null;
  pm_directory_id?: string | null;
  profileName?: string | null;
};

type DebugProject = {
  id: string;
  name: string;
  pm_id?: string | null;
  pm_directory_id?: string | null;
  resolvedPmGroup: string;
  assignments: DebugAssignment[];
};

export function OpsDebugPanel({ projects }: { projects: DebugProject[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : projects;

  return (
    <>
      {/* Fixed floating button — always visible */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: "#b45309",
          color: "#fff",
          fontWeight: 800,
          fontSize: 16,
          padding: "14px 20px",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          border: "3px solid #fbbf24",
          letterSpacing: "0.05em",
        }}
      >
        🐛 DEBUG ({projects.length})
      </button>

      {/* Overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ background: "#78350f", padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <input
              autoFocus
              placeholder="Filter by project name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 14,
                background: "#fef3c7",
                color: "#1c1917",
              }}
            />
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "#dc2626",
                color: "#fff",
                fontWeight: 800,
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 14,
                border: "none",
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ overflowY: "auto", flex: 1, padding: 16, fontFamily: "monospace", fontSize: 12, color: "#fef3c7" }}>
            {filtered.length === 0 && (
              <p style={{ color: "#fca5a5" }}>No projects match.</p>
            )}
            {filtered.map((p) => (
              <div key={p.id} style={{ marginBottom: 20, borderBottom: "1px solid #92400e", paddingBottom: 16 }}>
                <p style={{ fontWeight: 800, fontSize: 14, color: "#fde68a", marginBottom: 4 }}>{p.name}</p>
                <p>→ <strong>Resolved PM:</strong> <span style={{ color: "#6ee7b7" }}>{p.resolvedPmGroup}</span></p>
                <p style={{ marginTop: 4 }}>pm_id: <span style={{ color: "#fca5a5" }}>{p.pm_id ?? "NULL"}</span></p>
                <p>pm_directory_id: <span style={{ color: "#fca5a5" }}>{p.pm_directory_id ?? "NULL"}</span></p>
                <p style={{ marginTop: 6, marginBottom: 2, color: "#d1fae5" }}>Assignments ({p.assignments.length}):</p>
                {p.assignments.length === 0 && <p style={{ color: "#f87171", marginLeft: 12 }}>— none —</p>}
                {p.assignments.map((a, i) => (
                  <p key={i} style={{ marginLeft: 12, color: a.role_on_project === "pm" ? "#fde68a" : "#a8a29e" }}>
                    [{a.role_on_project}] is_primary={String(a.is_primary)} | profile_id={a.profile_id ?? "null"} | pm_dir_id={a.pm_directory_id ?? "null"} | {a.profileName ?? "?"}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
