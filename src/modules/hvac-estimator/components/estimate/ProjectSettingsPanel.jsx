import { useEffect, useRef, useState } from "react";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { VERTICAL_MARKETS, ESTIMATE_SCOPE_MODES, normalizeEstimateScopeMode } from "./projectSettings.js";
export function ProjectSettingsPanel({ settings, onChange, costs, rawLbrHrs, itemCount, estimateId, onApplyDefaultInstallType, onUpdateAllPrices, updatingPrices = false }) {
  const S = settings;
  const [geoStatus, setGeoStatus] = useState("");
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const ORIGINS = {
    "pensacola":   { lon: -87.2519, lat: 30.4397 },
    "panama-city": { lon: -85.6602, lat: 30.1588 },
  };

  async function runGeocode() {
    const hasAddr = S.address || S.city || S.state || S.zip;
    if (!hasAddr) { setGeoStatus("Enter an address first"); return; }
    setGeoStatus("calculating");
    try {
      const headers = { "User-Agent": "HVAC-Estimator/1.0" };
      const base = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us";
      const structured = `${base}&street=${encodeURIComponent(S.address || "")}&city=${encodeURIComponent(S.city || "")}&state=${encodeURIComponent(S.state || "")}&postalcode=${encodeURIComponent(S.zip || "")}`;
      let geo = await fetch(structured, { headers }).then(r => r.json());
      if (!geo.length && (S.city || S.zip)) {
        const fallback = `${base}&city=${encodeURIComponent(S.city || "")}&state=${encodeURIComponent(S.state || "")}&postalcode=${encodeURIComponent(S.zip || "")}`;
        geo = await fetch(fallback, { headers }).then(r => r.json());
      }
      if (!geo.length) { setGeoStatus("Address not found"); return; }
      const { lat, lon } = geo[0];
      const o = ORIGINS[S.team || "pensacola"];
      const route = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${lon},${lat}?overview=false`
      ).then(r => r.json());
      const milesOW = Math.round(route.routes[0].distance / 1609.344 * 10) / 10;
      const miles = Math.round(milesOW * 2 * 10) / 10;
      onChangeRef.current({ milesOneWay: miles });
      setGeoStatus("✓ " + miles + " mi round trip from " + (S.team === "panama-city" ? "Panama City" : "Pensacola"));
    } catch {
      setGeoStatus("Lookup failed");
    }
  }

  // Auto-calculate trips: total hrs ÷ 10-hr day ÷ 2 persons per vehicle
  useEffect(() => {
    if (rawLbrHrs > 0) onChange({ trips: Math.max(1, Math.ceil(rawLbrHrs / 20)) });
  }, [rawLbrHrs]); // eslint-disable-line react-hooks/exhaustive-deps

  // helper renderers
  const pct = (key, label, min=0, max=100, step=1) => (
    <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <input type="number" min={min} max={max} step={step} value={S[key]}
          onChange={e => onChange({ [key]: parseFloat(e.target.value)||0 })}
          style={{ width:56, padding:"4px 6px", border:"1px solid "+T.border2, borderRadius:4,
            fontSize:12, fontFamily:T.mono, background:T.bg, color:T.text, outline:"none", textAlign:"center" }}/>
        <span style={{ fontSize:11, color:T.muted }}>%</span>
      </div>
    </label>
  );

  const toggle = (key, label, note="") => (
    <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none" }}>
      <div onClick={()=>onChange({[key]:!S[key]})}
        style={{ width:32, height:18, borderRadius:9, background:S[key]?T.blue:T.border2,
          position:"relative", transition:"background 0.2s", flexShrink:0, cursor:"pointer" }}>
        <div style={{ position:"absolute", top:2, left:S[key]?16:2, width:14, height:14,
          borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
      </div>
      <div>
        <div style={{ fontSize:12, color:T.text }}>{label}</div>
        {note && <div style={{ fontSize:10, color:T.muted }}>{note}</div>}
      </div>
    </label>
  );

  const numField = (key, label, unit="", width=72, step=1, min=0) => (
    <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <input type="number" min={min} step={step} value={S[key]}
          onChange={e => onChange({ [key]: parseFloat(e.target.value)||0 })}
          style={{ width, padding:"4px 6px", border:"1px solid "+T.border2, borderRadius:4,
            fontSize:12, fontFamily:T.mono, background:T.bg, color:T.text, outline:"none", textAlign:"center" }}/>
        {unit && <span style={{ fontSize:11, color:T.muted }}>{unit}</span>}
      </div>
    </label>
  );

  const textField = (key, label, placeholder="") => (
    <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      <input
        type="text"
        value={S[key] || ""}
        placeholder={placeholder}
        onChange={e => onChange({ [key]: e.target.value })}
        style={{ padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
          fontSize:12, background:T.bg, color:T.text, outline:"none" }}
      />
    </label>
  );

  const selectField = (key, label, options, note="") => (
    <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      <select
        value={S[key] || options[0]?.value || ""}
        onChange={e => onChange({ [key]: e.target.value })}
        style={{ padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
          fontSize:12, background:T.bg, color:T.text, outline:"none", fontFamily:T.mono }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {note && <div style={{ fontSize:10, color:T.dim }}>{note}</div>}
    </label>
  );

  const section = (title, color, children) => (
    <div style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:8,
      overflow:"hidden", flex:"1 1 280px", minWidth:260 }}>
      <div style={{ padding:"7px 14px", background:color+"12", borderBottom:"1px solid "+color+"30" }}>
        <span style={{ fontSize:10, fontWeight:700, color, fontFamily:T.mono,
          textTransform:"uppercase", letterSpacing:1.5 }}>{title}</span>
      </div>
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {children}
      </div>
    </div>
  );

  const row = (...fields) => (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>{fields}</div>
  );

  return (
    <div style={{ borderBottom:"1px solid "+T.border, background:T.faint, flexShrink:0 }}>
      {/* Cost summary bar */}
      <div style={{ display:"flex", alignItems:"stretch", borderBottom:"1px solid "+T.border,
        background:T.surface }}>
        {[
          { label:"Raw Labor",   val:rawLbrHrs*S.wageRate, sub:fmtHr(rawLbrHrs)+" @ $"+S.wageRate, color:T.steel  },
          { label:"Raw Material",val:costs.rawMtl,         sub:"before adjustments",              color:T.blue   },
          { label:"Labor (adj)", val:costs.labor,          sub:"after adjustments",               color:T.steel  },
          { label:"Material (adj)",val:costs.material,     sub:"after adjustments",               color:T.blue   },
          { label:"Overhead "+S.overheadPct+"%", val:costs.overhead, sub:"includes all OHD items", color:"#7C3AED"},
          { label:"Profit "+S.profitPct+"%",     val:costs.profit,   sub:"of L+M+OH",              color:T.green  },
          { label:"Bond "+S.bondPct+"%",         val:costs.bond,     sub:"of total before bond",   color:"#B45309"},
          { label:"TOTAL",       val:costs.total,          sub:"all-in sell price",               color:T.text, bold:true },
        ].map(({label,val,sub,color,bold})=>(
          <div key={label} style={{ flex:1, padding:"8px 12px", borderRight:"1px solid "+T.border,
            minWidth:80 }}>
            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase",
              letterSpacing:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:bold?800:700, color, fontFamily:T.mono,
              marginTop:1 }}>{fmt$(val)}</div>
            <div style={{ fontSize:9, color:T.dim, marginTop:1 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Settings sections */}
      <div style={{ padding:"14px 20px", display:"flex", gap:12, flexWrap:"wrap" }}>

        {/* Bid version */}
        {section("Bid Version", "#0F766E", <>
          <div style={{ display:"grid", gap:8, gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))" }}>
            {ESTIMATE_SCOPE_MODES.map((mode) => {
              const checked = normalizeEstimateScopeMode(S.estimateScopeMode) === mode.id;
              return (
                <label key={mode.id} style={{ display:"flex", gap:8, alignItems:"flex-start", cursor:"pointer",
                  border:`1px solid ${checked ? "#2563EB" : T.border2}`, background: checked ? "#EFF6FF" : T.bg,
                  borderRadius:6, padding:"8px 10px" }}>
                  <input type="radio" name="estimateScopeMode" checked={checked}
                    onChange={() => onChange({ estimateScopeMode: mode.id })}
                    style={{ marginTop:2, accentColor:T.blue, cursor:"pointer" }} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, color:T.text, fontFamily:T.mono }}>{mode.label}</div>
                    <div style={{ fontSize:10, color:T.muted, lineHeight:1.4 }}>{mode.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize:10, color:T.dim, lineHeight:1.5 }}>
            Turnkey automatically computes Controls Material and Controls Engineering Labor from the same equipment selection using the controls catalog - no separate draft needed.
          </div>
        </>)}

        {/* Markups */}
        {section("Markups & Rates", T.blue, <>
          {row(pct("overheadPct","Overhead %",0,100), pct("profitPct","Profit %",0,100),
               pct("bondPct","Bond %",0,20,0.5))}
          {numField("wageRate","Wage Rate","$/hr",80,0.01)}
          {row(
            <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Default Install Type</span>
              <select value={S.defaultInstallType} onChange={e=>onChange({ defaultInstallType: e.target.value })}
                style={{ padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                  fontSize:12, background:T.bg, color:T.text, outline:"none", fontFamily:T.mono }}>
                {["EMT", "Plenum"].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>,
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Apply To Existing Items</span>
              <button
                onClick={() => {
                  if (!estimateId || !itemCount) return;
                  const confirmed = window.confirm(
                    `Apply ${S.defaultInstallType} to ${itemCount} item${itemCount !== 1 ? "s" : ""}? This will regenerate price snapshots for all existing items.`,
                  );
                  if (confirmed) onApplyDefaultInstallType(estimateId);
                }}
                disabled={!itemCount}
                style={{ padding:"6px 10px", border:"1px solid "+T.border2, borderRadius:4,
                  background:itemCount ? T.surface : T.faint, color:itemCount ? T.text : T.dim,
                  cursor:itemCount ? "pointer" : "default", fontSize:12, fontFamily:T.mono, textAlign:"left" }}
              >
                Apply {S.defaultInstallType} to {itemCount || 0} item{itemCount === 1 ? "" : "s"}
              </button>
            </div>,
            onUpdateAllPrices && (
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Re-capture Install Pricing</span>
                <button
                  onClick={onUpdateAllPrices}
                  disabled={updatingPrices}
                  title="Re-capture current equipment install pricing for every line item. Controls/DDC pricing is always live and updates automatically."
                  style={{ padding:"6px 10px", border:"1px solid "+T.border2, borderRadius:4,
                    background:T.surface, color:T.text,
                    cursor:updatingPrices ? "default" : "pointer", fontSize:12, fontFamily:T.mono, textAlign:"left",
                    opacity:updatingPrices ? 0.75 : 1 }}
                >
                  {updatingPrices ? "Updating Prices..." : "Update All Prices"}
                </button>
              </div>
            ),
          )}
        </>)}

        {/* Project location & mileage */}
        {section("Location & Travel", "#0891B2", <>
          {/* Team selection */}
          <div>
            <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Team</span>
            <div style={{ display:"flex", gap:16, marginTop:5 }}>
              {[["pensacola","Pensacola"],["panama-city","Panama City"]].map(([val,lbl])=>(
                <label key={val} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                  <input type="radio" name="team" value={val}
                    checked={(S.team||"pensacola")===val}
                    onChange={()=>{ onChange({team:val}); setGeoStatus(""); }}
                    style={{ accentColor:T.blue, cursor:"pointer" }}/>
                  <span style={{ fontSize:12, color:T.text }}>{lbl}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Address fields */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[["address","Street"],["city","City"],["state","State"],["zip","Zip"]].map(([k,lbl])=>(
              <label key={k} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{lbl}</span>
                <input value={S[k]||""} onChange={e=>{ onChange({[k]:e.target.value}); setGeoStatus(""); }}
                  style={{ padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                    fontSize:12, background:T.bg, color:T.text, outline:"none" }}/>
              </label>
            ))}
          </div>
          {/* Calculate button */}
          <button onClick={runGeocode}
            style={{ alignSelf:"flex-start", padding:"5px 12px", fontSize:11, fontFamily:T.mono,
              background:T.blue, color:"#fff", border:"none", borderRadius:4, cursor:"pointer" }}>
            Calculate Miles
          </button>
          {/* Geo status */}
          {geoStatus && (
            <div style={{ fontSize:10, fontFamily:T.mono,
              color: geoStatus==="calculating" ? T.muted : geoStatus.startsWith("✓") ? "#059669" : "#DC2626" }}>
              {geoStatus==="calculating" ? "⏳ Calculating miles…" : geoStatus}
            </div>
          )}
          {row(numField("milesOneWay","Miles (round trip)","mi",72),
               numField("mileageRate","Rate","$/mi",64,0.01),
               numField("trips","Trips","×",48))}
          <div style={{ fontSize:10, color:T.muted }}>
            Mileage cost: <strong style={{color:T.text}}>{fmt$(S.milesOneWay*S.mileageRate*S.trips)}</strong>
            {rawLbrHrs > 0 && <span style={{ marginLeft:10, color:T.dim }}>
              · {fmtHr(rawLbrHrs)} ÷ 20 hrs/trip = {Math.max(1,Math.ceil(rawLbrHrs/20))} trip{Math.max(1,Math.ceil(rawLbrHrs/20))!==1?"s":""}
            </span>}
          </div>
        </>)}

        {/* Labor & material adjustments */}
        {section("Labor & Material Adjustments", T.steel, <>
          <label style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Vertical Market</span>
            <select value={S.verticalMarket} onChange={e=>onChange({verticalMarket:e.target.value})}
              style={{ padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                fontSize:12, background:T.bg, color:T.text, outline:"none", fontFamily:T.mono }}>
              {VERTICAL_MARKETS.map(vm=>(
                <option key={vm.id} value={vm.id}>
                  {vm.label} {vm.factor>0?"+":"+"}{(vm.factor*100).toFixed(0)}%
                </option>
              ))}
            </select>
          </label>
          {toggle("siteAccess","Special Site Access","+5% labor")}
          {toggle("safetyReqs","Safety Requirements","+2% labor")}
          {toggle("supervision","Non-working Supervision","10% of labor hrs")}
          {toggle("vavFieldMount","VAV Field Mount","+0.5 hrs + $2 mtl per box")}
          {row(pct("occupiedPct","Occupied Space %",0,100),
               pct("workAbove15Pct","Work Above 15′ %",0,100))}
          {row(pct("overtimePct","Overtime %",0,100),
               pct("shiftPct","Shift Work %",0,100),
               pct("retrofitPct","Retrofit %",0,100))}
          <div style={{ borderTop:"1px solid "+T.border, paddingTop:8, marginTop:2 }}>
            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase",
              letterSpacing:1, marginBottom:8 }}>Material</div>
            {toggle("fireSeals","Fire Seals","$50 per $1,000 material")}
            {toggle("miscMaterials","Misc Materials","$20 per $1,000 material")}
          </div>
        </>)}

        {/* Overhead line items */}
        {section("Overhead Items", "#7C3AED", <>
          {numField("truckPerHour","Truck / Job Box","$/hr",72,0.50)}
          {row(numField("parkingDirect","Parking","$",80),
               numField("hotelMealsDirect","Hotel & Meals","$",80))}
          {toggle("drugTesting","Drug Testing","1% of hrs × 2× cost")}
          {toggle("permitFee","Permit Fee","1.5% of L+M")}
          <div style={{ borderTop:"1px solid "+T.border, paddingTop:8, marginTop:2 }}>
            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase",
              letterSpacing:1, marginBottom:8 }}>Equipment Rentals</div>
            {/* Scissor Lift */}
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Scissor Lift 25′</span>
              {row(numField("scissorLiftPickup","Pickup/Dropoff","$",80),
                   numField("scissorLiftDaily","Daily","$/day",72))}
              {row(numField("scissorLiftWeekly","Weekly","$/wk",72),
                   numField("scissorLiftMonthly","Monthly","$/mo",72))}
              {(() => {
                const liftDays = S.workAbove15Pct > 0 && rawLbrHrs > 0
                  ? Math.ceil(rawLbrHrs * (S.workAbove15Pct / 100) / 10) : 0;
                return liftDays > 0 ? (
                  <div style={{ fontSize:10, color:T.muted }}>
                    {liftDays} lift day{liftDays!==1?"s":""} needed · cost: <strong style={{color:T.text}}>{fmt$(costs.adjustments.overhead.scissorLift)}</strong>
                  </div>
                ) : null;
              })()}
            </div>
            {toggle("trencher","Trencher","$575 daily + P/U")}
            {numField("coreDrilling","Core Drilling","holes",64)}
          </div>
        </>)}

      </div>
    </div>
  );
}



