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
  return all.map((t) => TYPE_LABELS[t] ?? t).filter(Boolean).join(" / ");
}

const TEAL       = "#017a6f";
const TEAL_LIGHT = "#eef8f6";
const PAGE_BG    = "#f4f7f6";
const BORDER     = "#d1d5db";
const MUTED      = "#4b5563";
const QUIET      = "#9ca3af";
const TEXT       = "#111827";

const inputStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: TEXT,
  background: "#fff",
  fontFamily: "Arial, Helvetica, sans-serif",
};

export function DirectoryView({ title, contacts, generatedAt }: Props) {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy]         = useState<"company" | "name">("company");

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
        const hay = [c.display_name, c.account?.company_name, c.email, c.title].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter) {
        const all = c.account?.types?.length ? c.account.types : [c.account?.type ?? ""];
        if (!all.includes(typeFilter)) return false;
      }
      return true;
    });
  }, [contacts, search, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { company: Contact["account"]; contacts: Contact[] }>();
    for (const c of filtered) {
      const key = c.account?.id ?? "__none__";
      if (!map.has(key)) map.set(key, { company: c.account, contacts: [] });
      map.get(key)!.contacts.push(c);
    }
    let entries = Array.from(map.values());
    if (sortBy === "company") {
      entries.sort((a, b) => (a.company?.company_name ?? "").localeCompare(b.company?.company_name ?? ""));
    } else {
      entries.forEach((e) => e.contacts.sort((a, b) => a.display_name.localeCompare(b.display_name)));
      entries.sort((a, b) => (a.contacts[0]?.display_name ?? "").localeCompare(b.contacts[0]?.display_name ?? ""));
    }
    return entries;
  }, [filtered, sortBy]);

  const generatedDate = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  function handleDownload() {
    const html = buildStandaloneHtml(title, contacts, generatedAt);
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `TCC-Contact-Directory-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", background: PAGE_BG, minHeight: "100vh", color: TEXT }}>

      {/* Print actions bar — screen only */}
      <div style={{ maxWidth: "8in", margin: "0 auto", padding: "16px 24px 0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={handleDownload} style={pillBtn}>Download HTML</button>
        <button onClick={() => window.print()} style={pillBtn}>Print / Save PDF</button>
      </div>

      <div style={{ maxWidth: "8in", margin: "0 auto", padding: "0 24px 40px" }}>
        <article style={{ background: "#fff", border: `1px solid ${BORDER}`, padding: 28, marginTop: 12 }}>

          {/* Brand row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <img src="/logo.png" alt="The Controls Company" style={{ width: 120, height: 120, objectFit: "contain" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEAL, letterSpacing: "0.04em" }}>THE CONTROLS COMPANY, LLC</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Service Disabled Veteran Owned Small Business</div>
              <div style={{ fontSize: 12, color: MUTED }}>thecontrolscompany.com</div>
            </div>
            <img src="/sdvosb.jpg" alt="SDVOSB" style={{ width: 100, height: 100, objectFit: "contain" }} />
          </div>

          {/* Document title */}
          <h2 style={{ margin: "18px 0 0", textAlign: "center", fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {title}
          </h2>
          <p style={{ margin: "4px 0 0", textAlign: "center", fontSize: 12, color: QUIET }}>
            {filtered.length} contacts · {grouped.length} companies · as of {generatedDate}
          </p>

          {/* Filters — screen only */}
          <div style={{ margin: "20px 0 16px", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <input type="text" placeholder="Search name, company, email…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, minWidth: 240 }} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
              <option value="">All Types</option>
              {typeOptions.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "company" | "name")} style={inputStyle}>
              <option value="company">Sort by Company</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          {/* Directory */}
          {grouped.length === 0 ? (
            <p style={{ textAlign: "center", color: QUIET, padding: "40px 0" }}>No contacts match your filters.</p>
          ) : (
            grouped.map(({ company, contacts: gc }) => (
              <div key={company?.id ?? "__none__"} style={{ marginBottom: 24 }}>
                {/* Section header */}
                <div style={{ margin: "22px 0 10px", paddingBottom: 8, borderBottom: `2px solid ${TEAL}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEAL, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {company?.company_name ?? "Unknown"}
                    </h3>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      {company && <span style={{ fontSize: 11, color: MUTED }}>{fmtTypes(company)}</span>}
                      {company?.territory && <span style={{ fontSize: 11, color: QUIET }}>{company.territory}</span>}
                      {company?.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: TEAL }}>{company.website.replace(/^https?:\/\//, "")}</a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Name / Role", "Email", "Phone", "Mobile"].map((h) => (
                        <th key={h} style={{ background: TEAL_LIGHT, color: "#0f172a", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: `1px solid ${BORDER}`, padding: "7px 10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gc.map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                        <td style={{ border: `1px solid ${BORDER}`, padding: "8px 10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600, color: TEXT }}>{c.display_name}</div>
                          {c.title && <div style={{ fontSize: 11, color: MUTED }}>{c.title}</div>}
                          {ROLE_LABELS[c.role_type] && <div style={{ fontSize: 11, color: QUIET }}>{ROLE_LABELS[c.role_type]}</div>}
                        </td>
                        <td style={{ border: `1px solid ${BORDER}`, padding: "8px 10px", verticalAlign: "top" }}>
                          {c.email ? <a href={`mailto:${c.email}`} style={{ color: TEAL, fontSize: 12 }}>{c.email}</a> : <span style={{ color: QUIET }}>—</span>}
                        </td>
                        <td style={{ border: `1px solid ${BORDER}`, padding: "8px 10px", verticalAlign: "top" }}>
                          {c.phone ? <a href={`tel:${c.phone}`} style={{ color: TEXT, fontSize: 12, textDecoration: "none" }}>{c.phone}</a> : <span style={{ color: QUIET }}>—</span>}
                        </td>
                        <td style={{ border: `1px solid ${BORDER}`, padding: "8px 10px", verticalAlign: "top" }}>
                          {c.mobile && c.mobile !== c.phone ? <a href={`tel:${c.mobile}`} style={{ color: TEXT, fontSize: 12, textDecoration: "none" }}>{c.mobile}</a> : <span style={{ color: QUIET }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}

          {/* Footer */}
          <footer style={{ marginTop: 28, paddingTop: 14, borderTop: `2px solid ${TEAL}`, textAlign: "center", fontSize: 12, color: MUTED }}>
            <div>The Controls Company, LLC | thecontrolscompany.com</div>
            <div>Service Disabled Veteran Owned Small Business · Confidential · Link expires in 7 days</div>
          </footer>

        </article>
      </div>
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  borderRadius: 999,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Arial, Helvetica, sans-serif",
};

// ── Standalone HTML (references live logo URLs so they're always current) ──────

const LIVE_BASE = "https://internal.thecontrolscompany.com";

function buildStandaloneHtml(title: string, contacts: Contact[], generatedAt: string): string {
  const date = new Date(generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — The Controls Company</title>
<style>
:root{--teal:#017a6f;--teal-light:#eef8f6;--page-bg:#f4f7f6;--card-bg:#ffffff;--text:#111827;--label:#374151;--muted:#4b5563;--quiet:#9ca3af;--border:#d1d5db;--font:Arial,Helvetica,sans-serif}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--page-bg);color:var(--text);font-size:14px;line-height:1.5}
@page{size:letter portrait;margin:0.9in 0.75in 0.8in 0.75in}
@page landscape{size:letter landscape;margin:0.75in}
.page{max-width:8in;margin:0 auto;padding:24px}
.print-actions{display:flex;gap:12px;justify-content:flex-end;margin-bottom:16px}
.print-actions button{border:1px solid var(--border);background:var(--card-bg);color:var(--text);border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)}
.print-actions button:hover{border-color:var(--teal);color:var(--teal)}
.report{background:var(--card-bg);padding:28px;border:1px solid var(--border)}
.brand-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand-logo{width:120px;height:120px;object-fit:contain}
.brand-badge{width:100px;height:100px;object-fit:contain}
.brand-copy{flex:1;text-align:center}
.brand-copy h1{margin:0 0 4px;font-size:20px;color:var(--teal);letter-spacing:0.04em}
.brand-copy p{margin:0;font-size:12px;color:var(--muted)}
.doc-title{margin:18px 0 0;text-align:center;font-size:22px;font-weight:700;color:var(--text);letter-spacing:0.06em;text-transform:uppercase}
.doc-meta{margin:4px 0 0;text-align:center;font-size:12px;color:var(--quiet)}
.filters{margin:20px 0 16px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.filters input,.filters select{border:1px solid var(--border);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--text);background:#fff;font-family:var(--font)}
.filters input{min-width:240px}
.section-header{margin:22px 0 10px;padding-bottom:8px;border-bottom:2px solid var(--teal);display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px}
.section-header h3{margin:0;font-size:15px;font-weight:700;color:var(--teal);letter-spacing:0.06em;text-transform:uppercase}
.section-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.section-meta a{color:var(--teal)}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
th{background:var(--teal-light);color:#0f172a;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border:1px solid var(--border);padding:7px 10px}
td{border:1px solid var(--border);padding:8px 10px;vertical-align:top}
tr:nth-child(even) td{background:#f8fafc}
.contact-name{font-weight:600}
.contact-sub{font-size:11px;color:var(--muted)}
.contact-role{font-size:11px;color:var(--quiet)}
a.email{color:var(--teal);font-size:12px}
a.phone{color:var(--text);font-size:12px;text-decoration:none}
.dash{color:var(--quiet)}
.footer{margin-top:28px;padding-top:14px;border-top:2px solid var(--teal);text-align:center;font-size:12px;color:var(--muted)}
.empty{text-align:center;color:var(--quiet);padding:40px 0}
@media print{
  body{background:#fff}
  .no-print{display:none!important}
  .page{max-width:none;margin:0;padding:0}
  .report{border:0;padding:0}
  .filters{display:none}
}
</style>
</head>
<body>
<div class="page">
  <div class="print-actions no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <article class="report">
    <div class="brand-row">
      <img src="${LIVE_BASE}/logo.png" alt="The Controls Company" class="brand-logo" onerror="this.style.display='none'">
      <div class="brand-copy">
        <h1>THE CONTROLS COMPANY, LLC</h1>
        <p>Service Disabled Veteran Owned Small Business</p>
        <p style="margin-top:4px">thecontrolscompany.com</p>
      </div>
      <img src="${LIVE_BASE}/sdvosb.jpg" alt="SDVOSB" class="brand-badge" onerror="this.style.display='none'">
    </div>
    <h2 class="doc-title">${title}</h2>
    <p class="doc-meta" id="docmeta">Loading…</p>
    <div class="filters no-print">
      <input type="text" id="search" placeholder="Search name, company, email…" oninput="render()">
      <select id="typeFilter" onchange="render()"><option value="">All Types</option></select>
      <select id="sortBy" onchange="render()">
        <option value="company">Sort by Company</option>
        <option value="name">Sort by Name</option>
      </select>
    </div>
    <div id="directory"></div>
    <footer class="footer">
      <div>The Controls Company, LLC | thecontrolscompany.com</div>
      <div>Service Disabled Veteran Owned Small Business · Confidential</div>
    </footer>
  </article>
</div>
<script>
const TYPE_LABELS=${JSON.stringify(TYPE_LABELS)};
const ROLE_LABELS=${JSON.stringify(ROLE_LABELS)};
const DATA=${JSON.stringify({ contacts, generatedAt })};
const contacts=DATA.contacts;

function fmtTypes(a){const all=a.types&&a.types.length?a.types:[a.type];return all.map(t=>TYPE_LABELS[t]||t).filter(Boolean).join(' / ')}

// Populate type filter
const seen=new Set();
contacts.forEach(c=>{if(!c.account)return;const all=c.account.types&&c.account.types.length?c.account.types:[c.account.type];all.forEach(t=>seen.add(t))});
const tf=document.getElementById('typeFilter');
Array.from(seen).sort().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=TYPE_LABELS[t]||t;tf.appendChild(o)});

function render(){
  const q=document.getElementById('search').value.toLowerCase();
  const tf=document.getElementById('typeFilter').value;
  const sb=document.getElementById('sortBy').value;
  let filtered=contacts.filter(c=>{
    if(q){const h=[c.display_name,c.account?.company_name,c.email,c.title].join(' ').toLowerCase();if(!h.includes(q))return false}
    if(tf){const all=c.account?.types?.length?c.account.types:[c.account?.type||''];if(!all.includes(tf))return false}
    return true;
  });
  const map=new Map();
  filtered.forEach(c=>{const k=c.account?.id||'__none__';if(!map.has(k))map.set(k,{company:c.account,contacts:[]});map.get(k).contacts.push(c)});
  let groups=Array.from(map.values());
  if(sb==='company')groups.sort((a,b)=>(a.company?.company_name||'').localeCompare(b.company?.company_name||''));
  else{groups.forEach(g=>g.contacts.sort((a,b)=>a.display_name.localeCompare(b.display_name)));groups.sort((a,b)=>(a.contacts[0]?.display_name||'').localeCompare(b.contacts[0]?.display_name||''))}
  document.getElementById('docmeta').textContent=filtered.length+' contacts · '+groups.length+' companies · as of ${date}';
  const dir=document.getElementById('directory');
  if(!groups.length){dir.innerHTML='<p class="empty">No contacts match.</p>';return}
  dir.innerHTML=groups.map(({company:co,contacts:gc})=>\`
    <div class="section-header">
      <h3>\${co?.company_name||'Unknown'}</h3>
      <div class="section-meta">
        \${co?'<span>'+fmtTypes(co)+'</span>':''}
        \${co?.territory?'<span>'+co.territory+'</span>':''}
        \${co?.website?'<a href="'+co.website+'" target="_blank">'+co.website.replace(/^https?:\\/\\//,'')+'</a>':''}
      </div>
    </div>
    <table>
      <thead><tr><th>Name / Role</th><th>Email</th><th>Phone</th><th>Mobile</th></tr></thead>
      <tbody>\${gc.map(c=>\`<tr>
        <td><div class="contact-name">\${c.display_name}</div>\${c.title?'<div class="contact-sub">'+c.title+'</div>':''}\${ROLE_LABELS[c.role_type]?'<div class="contact-role">'+ROLE_LABELS[c.role_type]+'</div>':''}</td>
        <td>\${c.email?'<a class="email" href="mailto:'+c.email+'">'+c.email+'</a>':'<span class="dash">—</span>'}</td>
        <td>\${c.phone?'<a class="phone" href="tel:'+c.phone+'">'+c.phone+'</a>':'<span class="dash">—</span>'}</td>
        <td>\${c.mobile&&c.mobile!==c.phone?'<a class="phone" href="tel:'+c.mobile+'">'+c.mobile+'</a>':'<span class="dash">—</span>'}</td>
      </tr>\`).join('')}</tbody>
    </table>
  \`).join('');
}
render();
</script>
</body>
</html>`;
}

const TYPE_LABELS_JS: Record<string, string> = TYPE_LABELS;
const ROLE_LABELS_JS: Record<string, string> = ROLE_LABELS;
