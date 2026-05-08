import { useState, useEffect } from "react";
import { T } from "./tokens.js";
import { HELP_MAP, HELP_NAV } from "./helpContext.js";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(md) {
  return esc(md)
    .split(/\n{2,}/)
    .map(block => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("# ")) return `<h1>${text.slice(2)}</h1>`;
      if (text.startsWith("## ")) return `<h2>${text.slice(3)}</h2>`;
      if (text.startsWith("### ")) return `<h3>${text.slice(4)}</h3>`;
      if (/^- /m.test(text)) {
        const items = text.split("\n").map(line => line.replace(/^- /, "").trim()).filter(Boolean);
        return `<ul>${items.map(item => `<li>${item}</li>`).join("")}</ul>`;
      }
      return `<p>${text.replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

export function HelpPanel({ contextKey, onClose }) {
  const [currentFile, setCurrentFile] = useState(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-navigate to context-relevant page when panel opens or context changes.
  useEffect(() => {
    const entry = HELP_MAP[contextKey];
    setCurrentFile(entry?.file || "quick-start.md");
  }, [contextKey]);

  useEffect(() => {
    if (!currentFile) return;
    setLoading(true);
    fetch(`/help/${currentFile}`)
      .then(r => r.ok ? r.text() : "# Content Coming Soon\n\nThis section is under development.")
      .catch(() => "# Content Coming Soon\n\nThis section is under development.")
      .then(md => {
        setHtml(renderMarkdown(md));
        setLoading(false);
      });
  }, [currentFile]);

  const currentTitle = (() => {
    for (const section of HELP_NAV) {
      const item = section.items.find(i => i.file === currentFile);
      if (item) return item.label;
    }
    return "Help";
  })();

  const handleContentClick = e => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("http")) return;
    e.preventDefault();
    const file = href.replace(/^\/help\//, "");
    setCurrentFile(file);
  };

  return (
    <>
      <style>{`
        .help-content h1 { font-size:17px; font-weight:700; margin:0 0 14px; color:var(--t-text); }
        .help-content h2 { font-size:14px; font-weight:700; margin:20px 0 8px; color:var(--t-text);
          border-bottom:1px solid var(--t-border); padding-bottom:5px; }
        .help-content h3 { font-size:13px; font-weight:600; margin:16px 0 6px; color:var(--t-text); }
        .help-content p  { margin:0 0 10px; }
        .help-content ul, .help-content ol { margin:0 0 10px; padding-left:20px; }
        .help-content li { margin:3px 0; }
        .help-content strong { font-weight:600; }
        .help-content code { font-family:IBM Plex Mono,Courier New,monospace; font-size:11px;
          background:var(--t-panel); padding:1px 5px; border-radius:3px; }
        .help-content a { color:var(--t-blue); text-decoration:none; cursor:pointer; }
        .help-content a:hover { text-decoration:underline; }
        .help-content blockquote { border-left:3px solid var(--t-border2); margin:0 0 10px;
          padding:4px 0 4px 12px; color:var(--t-muted); }
        .help-content hr { border:none; border-top:1px solid var(--t-border); margin:18px 0; }
        .help-content table { border-collapse:collapse; width:100%; margin:0 0 12px; font-size:12px; }
        .help-content th { background:var(--t-panel); padding:5px 10px; text-align:left;
          border:1px solid var(--t-border); font-weight:600; }
        .help-content td { padding:5px 10px; border:1px solid var(--t-border); }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.25)", zIndex:800 }}
      />

      {/* Panel */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, width:520, maxWidth:"95vw",
        background:T.surface, borderLeft:"1px solid "+T.border, zIndex:801,
        display:"flex", flexDirection:"column",
        boxShadow:"-10px 0 40px rgba(0,0,0,0.12)",
      }}>

        {/* Header */}
        <div style={{
          padding:"13px 16px", borderBottom:"1px solid "+T.border, flexShrink:0,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:T.muted, fontFamily:T.mono,
              textTransform:"uppercase", letterSpacing:1 }}>Help</span>
            {currentTitle && (
              <>
                <span style={{ color:T.border2, fontSize:11 }}>›</span>
                <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{currentTitle}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background:"none", border:"none", fontSize:20, color:T.muted,
              cursor:"pointer", lineHeight:1, padding:"2px 4px" }}
          >×</button>
        </div>

        {/* Nav */}
        <div style={{
          padding:"10px 14px", borderBottom:"1px solid "+T.border, flexShrink:0,
          display:"flex", flexDirection:"column", gap:8,
        }}>
          {HELP_NAV.map(section => (
            <div key={section.label} style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap" }}>
              <span style={{
                fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase",
                letterSpacing:1, flexShrink:0, minWidth:96,
              }}>{section.label}</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                {section.items.map(item => {
                  const active = currentFile === item.file;
                  return (
                    <button
                      key={item.file}
                      onClick={() => setCurrentFile(item.file)}
                      style={{
                        padding:"2px 8px", fontSize:11, fontFamily:T.mono,
                        borderRadius:3, cursor:"pointer",
                        border:"1px solid "+(active ? T.blue : T.border2),
                        background:active ? T.blueFaint : "transparent",
                        color:active ? T.blue : T.muted,
                        fontWeight:active ? 600 : 400,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>
          {loading ? (
            <div style={{ color:T.muted, fontSize:13, fontFamily:T.mono }}>Loading…</div>
          ) : (
            <div
              className="help-content"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={handleContentClick}
              style={{ fontSize:13, lineHeight:1.7, color:T.text }}
            />
          )}
        </div>

      </div>
    </>
  );
}
