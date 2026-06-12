import { T } from "../../shared/tokens.js";
const DEFAULT_BUTTONS = [
    { type:"ahu",     label:"AHU",     bg:"#0D9488", },
    { type:"vav",     label:"VAV",     bg:T.blue,    },
    { type:"rtu",     label:"RTU",     bg:"#7C3AED", },
    { type:"dx",      label:"DX/HP",   bg:"#4338CA", },
    { type:"vrf",     label:"VRF",     bg:"#047857", },
    { type:"fcu",     label:"FCU",     bg:"#EA580C", },
    { type:"uh",      label:"UH",      bg:"#DC2626", },
    { type:"plant",   label:"Plant",   bg:"#0369A1", },
    { type:"network", label:"Network", bg:"#059669", },
    { type:"exhaust-fan", label:"Exhaust Fan", bg:"#B45309", },
    { type:"custom", label:"Custom", bg:"#6B7280", },
  ];

export function AddEquipButtons({ onAdd, buttons = DEFAULT_BUTTONS, compact = false, className = "" }) {
  const gap = compact ? 4 : 5;
  const padding = compact ? "6px 10px" : "7px 12px";
  const fontSize = compact ? 10 : 11;
  return (
    <div className={className} style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
      <div style={{ display:"flex", gap, flexShrink:0, flexWrap:"wrap" }}>
        {buttons.map(b => (
          <button key={b.type} onClick={()=>onAdd(b.type)} style={{
            padding,
            border:"none",
            borderRadius:5,
            background:b.bg,
            color:"#fff",
            cursor:"pointer",
            fontSize,
            fontFamily:T.mono,
            fontWeight:700,
            lineHeight:1.1,
            boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",
          }}>
            + {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}


