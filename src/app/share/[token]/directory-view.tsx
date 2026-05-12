"use client";

import { useState, useMemo } from "react";

type Contact = {
  id: string;
  display_name: string;
  title: string | null;
  role_type: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  account: {
    id: string;
    company_name: string;
    type: string;
    types: string[];
    territory: string | null;
    website: string | null;
  } | null;
};

type Props = {
  title: string;
  contacts: Contact[];
  generatedAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  general_contractor:    "General Contractor",
  mechanical_contractor: "Mechanical Contractor",
  electrical_contractor: "Electrical Contractor",
  tab_commissioning:     "TAB / Commissioning",
  controls_contractor:   "Controls Contractor",
  hvac_oem:              "HVAC OEM",
  controls_oem:          "Controls OEM",
  owner:                 "Owner",
  other:                 "Other",
};

const ROLE_LABELS: Record<string, string> = {
  salesperson:            "Salesperson",
  sales_manager:          "Sales Manager",
  estimator:              "Estimator",
  project_manager:        "Project Manager",
  senior_project_manager: "Senior PM",
  operations_manager:     "Ops Manager",
  owner:                  "Owner",
  cfo:                    "CFO",
  cfo_estimator:          "CFO / Estimator",
  unknown:                "",
};

function fmtTypes(account: Contact["account"]): string {
  if (!account) return "";
  const all = account.types?.length ? account.types : [account.type];
  return all.map((t) => TYPE_LABELS[t] ?? t).join(" / ");
}

export function DirectoryView({ title, contacts, generatedAt }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"company" | "name">("company");

  // Unique company types present in data
  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of contacts) {
      if (!c.account) continue;
      const all = c.account.types?.length ? c.account.types : [c.account.type];
      all.forEach((t) => seen.add(t));
    }
    return Array.from(seen).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      if (q) {
        const matches =
          c.display_name.toLowerCase().includes(q) ||
          c.account?.company_name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (typeFilter) {
        const all = c.account?.types?.length ? c.account.types : [c.account?.type ?? ""];
        if (!all.includes(typeFilter)) return false;
      }
      return true;
    });
  }, [contacts, search, typeFilter]);

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map<string, { company: Contact["account"]; contacts: Contact[] }>();
    for (const c of filtered) {
      const key = c.account?.id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, { company: c.account, contacts: [] });
      }
      map.get(key)!.contacts.push(c);
    }

    let entries = Array.from(map.values());

    if (sortBy === "company") {
      entries.sort((a, b) =>
        (a.company?.company_name ?? "").localeCompare(b.company?.company_name ?? "")
      );
    } else {
      // Sort each group's contacts alphabetically
      entries.forEach((e) => e.contacts.sort((a, b) => a.display_name.localeCompare(b.display_name)));
      entries.sort((a, b) =>
        (a.contacts[0]?.display_name ?? "").localeCompare(b.contacts[0]?.display_name ?? "")
      );
    }

    return entries;
  }, [filtered, sortBy]);

  const generatedDate = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  function handleDownload() {
    const html = buildStandaloneHtml(title, contacts, generatedAt);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TCC-Contact-Directory-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#0f172a", color: "#f1f5f9", padding: "24px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>The Controls Company</span>
            </div>
            <h1 style={{ fontSize: 14, fontWeight: 400, color: "#94a3b8", margin: 0 }}>{title}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {filtered.length} contacts · {grouped.length} companies · as of {generatedDate}
            </span>
            <button
              onClick={handleDownload}
              style={{
                background: "transparent", border: "1px solid #334155", color: "#94a3b8",
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              }}
            >
              Download HTML
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            type="text"
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
            <option value="">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "company" | "name")} style={inputStyle}>
            <option value="company">Sort by Company</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Directory */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 32px" }}>
        {grouped.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: "48px 0" }}>No contacts match your filters.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {grouped.map(({ company, contacts: groupContacts }) => (
              <div
                key={company?.id ?? "__none__"}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}
              >
                {/* Company header */}
                <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                      {company?.company_name ?? "Unknown Company"}
                    </span>
                    {company && (
                      <span style={{ marginLeft: 10, fontSize: 11, color: "#64748b", background: "#e2e8f0", borderRadius: 20, padding: "2px 8px" }}>
                        {fmtTypes(company)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {company?.territory && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{company.territory}</span>
                    )}
                    {company?.website && (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#3b82f6" }}>
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{groupContacts.length} contact{groupContacts.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Contact rows */}
                <div>
                  {groupContacts.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 12,
                        padding: "10px 20px",
                        borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{c.display_name}</div>
                        {c.title && <div style={{ fontSize: 11, color: "#64748b" }}>{c.title}</div>}
                        {ROLE_LABELS[c.role_type] && (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{ROLE_LABELS[c.role_type]}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#334155" }}>
                        {c.email ? (
                          <a href={`mailto:${c.email}`} style={{ color: "#3b82f6", textDecoration: "none" }}>{c.email}</a>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#334155" }}>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} style={{ color: "#334155", textDecoration: "none" }}>{c.phone}</a>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#334155" }}>
                        {c.mobile && c.mobile !== c.phone ? (
                          <a href={`tel:${c.mobile}`} style={{ color: "#334155", textDecoration: "none" }}>{c.mobile}</a>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "#cbd5e1" }}>
          The Controls Company, LLC · Confidential · This link expires in 30 days
        </p>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 13,
  color: "#1e293b",
  background: "#fff",
  outline: "none",
};

// ── Standalone HTML generator ─────────────────────────────────────────────────

function buildStandaloneHtml(title: string, contacts: Contact[], generatedAt: string): string {
  const data = JSON.stringify({ contacts, generatedAt });
  const date = new Date(generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — The Controls Company</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b}
header{background:#0f172a;color:#f1f5f9;padding:24px 32px}
.header-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.brand{font-size:22px;font-weight:900;letter-spacing:-0.5px}
.subtitle{font-size:13px;color:#94a3b8;margin-top:4px}
.meta{font-size:12px;color:#64748b}
.filters{background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 32px}
.filters-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px}
input,select{border:1px solid #e2e8f0;border-radius:8px;padding:7px 12px;font-size:13px;color:#1e293b;background:#fff;outline:none}
input{min-width:240px}
main{max-width:960px;margin:0 auto;padding:24px 32px}
.company-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px}
.company-header{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.company-name{font-weight:700;font-size:15px;color:#0f172a}
.company-type{margin-left:10px;font-size:11px;color:#64748b;background:#e2e8f0;border-radius:20px;padding:2px 8px}
.company-meta{font-size:11px;color:#94a3b8}
.contact-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;padding:10px 20px;align-items:center;border-top:1px solid #f1f5f9}
.contact-row:first-child{border-top:none}
.contact-name{font-weight:600;font-size:13px;color:#1e293b}
.contact-title{font-size:11px;color:#64748b}
.contact-role{font-size:11px;color:#94a3b8}
.contact-email{font-size:12px}
.contact-phone{font-size:12px}
a{color:#3b82f6;text-decoration:none}
a.phone-link{color:#334155}
.empty{text-align:center;color:#94a3b8;padding:48px 0}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#cbd5e1}
.hidden{display:none}
</style>
</head>
<body>
<header>
  <div class="header-inner">
    <div>
      <div class="brand">The Controls Company</div>
      <div class="subtitle">${title}</div>
    </div>
    <div class="meta" id="meta-count">Loading…</div>
  </div>
</header>
<div class="filters">
  <div class="filters-inner">
    <input type="text" id="search" placeholder="Search name, company, email…" oninput="render()">
    <select id="typeFilter" onchange="render()"><option value="">All Types</option></select>
    <select id="sortBy" onchange="render()">
      <option value="company">Sort by Company</option>
      <option value="name">Sort by Name</option>
    </select>
  </div>
</div>
<main id="main"></main>

<script>
const TYPE_LABELS = ${JSON.stringify(Object.fromEntries(Object.entries({
    general_contractor: "General Contractor", mechanical_contractor: "Mechanical Contractor",
    electrical_contractor: "Electrical Contractor", tab_commissioning: "TAB / Commissioning",
    controls_contractor: "Controls Contractor", hvac_oem: "HVAC OEM",
    controls_oem: "Controls OEM", owner: "Owner", other: "Other"
  })))};
const ROLE_LABELS = ${JSON.stringify(Object.fromEntries(Object.entries({
    salesperson: "Salesperson", sales_manager: "Sales Manager", estimator: "Estimator",
    project_manager: "Project Manager", senior_project_manager: "Senior PM",
    operations_manager: "Ops Manager", owner: "Owner", cfo: "CFO",
    cfo_estimator: "CFO / Estimator", unknown: ""
  })))};

const ALL_DATA = ${data};
const contacts = ALL_DATA.contacts;

// Populate type filter
const typeSet = new Set();
contacts.forEach(c => {
  if (!c.account) return;
  const types = c.account.types && c.account.types.length ? c.account.types : [c.account.type];
  types.forEach(t => typeSet.add(t));
});
const tf = document.getElementById('typeFilter');
Array.from(typeSet).sort().forEach(t => {
  const o = document.createElement('option');
  o.value = t; o.textContent = TYPE_LABELS[t] || t;
  tf.appendChild(o);
});

function fmtTypes(account) {
  const all = account.types && account.types.length ? account.types : [account.type];
  return all.map(t => TYPE_LABELS[t] || t).join(' / ');
}

function render() {
  const q = document.getElementById('search').value.toLowerCase();
  const typeFilter = document.getElementById('typeFilter').value;
  const sortBy = document.getElementById('sortBy').value;

  let filtered = contacts.filter(c => {
    if (q) {
      const m = (c.display_name + ' ' + (c.account?.company_name||'') + ' ' + (c.email||'') + ' ' + (c.title||'')).toLowerCase();
      if (!m.includes(q)) return false;
    }
    if (typeFilter) {
      const all = c.account?.types?.length ? c.account.types : [c.account?.type || ''];
      if (!all.includes(typeFilter)) return false;
    }
    return true;
  });

  // Group by company
  const map = new Map();
  filtered.forEach(c => {
    const key = c.account?.id || '__none__';
    if (!map.has(key)) map.set(key, { company: c.account, contacts: [] });
    map.get(key).contacts.push(c);
  });

  let groups = Array.from(map.values());
  if (sortBy === 'company') {
    groups.sort((a,b) => (a.company?.company_name||'').localeCompare(b.company?.company_name||''));
  } else {
    groups.forEach(g => g.contacts.sort((a,b) => a.display_name.localeCompare(b.display_name)));
    groups.sort((a,b) => (a.contacts[0]?.display_name||'').localeCompare(b.contacts[0]?.display_name||''));
  }

  document.getElementById('meta-count').textContent =
    filtered.length + ' contacts · ' + groups.length + ' companies · as of ${date}';

  const main = document.getElementById('main');
  if (groups.length === 0) {
    main.innerHTML = '<p class="empty">No contacts match your filters.</p>';
    return;
  }

  main.innerHTML = groups.map(({ company, contacts: gc }) => \`
    <div class="company-card">
      <div class="company-header">
        <div>
          <span class="company-name">\${company?.company_name || 'Unknown'}</span>
          \${company ? \`<span class="company-type">\${fmtTypes(company)}</span>\` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          \${company?.territory ? \`<span class="company-meta">\${company.territory}</span>\` : ''}
          \${company?.website ? \`<a href="\${company.website}" target="_blank">\${company.website.replace(/^https?:\\/\\//, '')}</a>\` : ''}
          <span class="company-meta">\${gc.length} contact\${gc.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      \${gc.map((c, i) => \`
        <div class="contact-row">
          <div>
            <div class="contact-name">\${c.display_name}</div>
            \${c.title ? \`<div class="contact-title">\${c.title}</div>\` : ''}
            \${ROLE_LABELS[c.role_type] ? \`<div class="contact-role">\${ROLE_LABELS[c.role_type]}</div>\` : ''}
          </div>
          <div class="contact-email">\${c.email ? \`<a href="mailto:\${c.email}">\${c.email}</a>\` : '<span style="color:#cbd5e1">—</span>'}</div>
          <div class="contact-phone">\${c.phone ? \`<a class="phone-link" href="tel:\${c.phone}">\${c.phone}</a>\` : '<span style="color:#cbd5e1">—</span>'}</div>
          <div class="contact-phone">\${c.mobile && c.mobile !== c.phone ? \`<a class="phone-link" href="tel:\${c.mobile}">\${c.mobile}</a>\` : '<span style="color:#cbd5e1">—</span>'}</div>
        </div>
      \`).join('')}
    </div>
  \`).join('');

  main.innerHTML += '<p class="footer">The Controls Company, LLC · Confidential</p>';
}

render();
</script>
</body>
</html>`;
}
