import { useEffect, useMemo, useRef, useState } from "react";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { AssemblyPickerModal } from "../../shared/AssemblyPickerModal.jsx";
import { toAssemblyOptions } from "../../shared/assemblyPicker.js";
import {
  DEFAULT_AHU_CFG,
  AHU_TYPES,
  FAN_CONFIGS,
  RETURN_CONFIGS,
  AHU_COMPS,
  AHU_COOLING_TYPES,
  AHU_ECONOMIZER_TYPES,
  AHU_HEAT_RECOVERY_TYPES,
  AHU_HEATING_TYPES,
  AHU_PREHEAT_TYPES,
  AHU_RETURN_FAN_TYPES,
  AHU_SUPPLY_FAN_TYPES,
  getVisibleAhuComponents,
  normalizeAhuCfg,
  reconcileAhuSelected,
  toggleAhuComponentSelection,
} from "./ahuData.js";
import { AddToEstimateBtn } from "../../shared/AddToEstimateBtn.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { calcAssembly, ASSEMBLIES, UNIT_ITEMS } from "../../shared/assemblyData.js";
import { SidebarLayout } from "../../shared/SidebarLayout.jsx";
import { SchematicTabs } from "../../shared/SchematicTabs.jsx";
import { DiagramViewer } from "../../shared/DiagramViewer.jsx";
import { PointsList } from "../../shared/PointsList.jsx";
import { ProjectHubOntologyGraphicPanel } from "../../shared/ProjectHubOntologyGraphicPanel";
import {
  buildCableBundleFromPoints,
  CONDUIT_FILL_BUNDLE_KEY,
  CONDUIT_FILL_CONTEXT_KEY,
  findHomeRunComponentId,
} from "../../shared/conduitFill.js";
import { resolveProjectHubGraphicsSource } from "../../shared/projecthubGraphics";

const DuctWall = ({x,y,w,h}) => (
  <g>
    <line x1={x} y1={y}   x2={x+w} y2={y}   stroke={T.text} strokeWidth="3"/>
    <line x1={x} y1={y+h} x2={x+w} y2={y+h} stroke={T.text} strokeWidth="3"/>
  </g>
);

const Damper = ({cx,cy,sz=13,color}) => (
  <g>
    <rect x={cx-sz} y={cy-sz*.5} width={sz*2} height={sz}
      fill="none" stroke={color||T.dim} strokeWidth="2" rx="1"/>
    <line x1={cx-sz+2} y1={cy-sz*.5+2} x2={cx+sz-2} y2={cy+sz*.5-2} stroke={color||T.dim} strokeWidth="2"/>
    <line x1={cx-sz+2} y1={cy+sz*.5-2} x2={cx+sz-2} y2={cy-sz*.5+2} stroke={color||T.dim} strokeWidth="1.2" opacity="0.45"/>
  </g>
);

const Fan = ({cx,cy,r=19,color}) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color||T.dim} strokeWidth="2.5"/>
    <path d={`M${cx} ${cy-r+4} Q${cx+r*.7} ${cy} ${cx} ${cy+r-4}`} fill={color?color+"18":T.faint} stroke={color||T.dim} strokeWidth="1.5"/>
    <path d={`M${cx} ${cy+r-4} Q${cx-r*.7} ${cy} ${cx} ${cy-r+4}`} fill={color?color+"18":T.faint} stroke={color||T.dim} strokeWidth="1.5"/>
    <circle cx={cx} cy={cy} r="3" fill={color||T.dim}/>
  </g>
);

const Coil = ({x,y,w,h,color,label}) => {
  const steps=5, sw=w/steps;
  const pts = Array.from({length:steps+1},(_,i)=>`${x+i*sw},${i%2===0?y:y+h}`).join(" ");
  return (
    <g>
      <rect x={x-2} y={y-2} width={w+4} height={h+4} fill={color+"10"} stroke={color} strokeWidth="1.5" rx="2"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"/>
      {label && <text x={x+w/2} y={y+h+14} textAnchor="middle" fontSize="8" fill={color} fontFamily={T.mono} fontWeight="700">{label}</text>}
    </g>
  );
};

const FilterSym = ({x,y,h,color,label}) => (
  <g>
    <rect x={x-4} y={y} width={8} height={h} fill={color+"15"} stroke={color} strokeWidth="2" rx="1"/>
    {[.25,.5,.75].map(f=>(
      <line key={f} x1={x-4} y1={y+h*f} x2={x+4} y2={y+h*f} stroke={color} strokeWidth="1.5"/>
    ))}
    {label && <text x={x} y={y+h+13} textAnchor="middle" fontSize="8" fill={color} fontFamily={T.mono}>{label}</text>}
  </g>
);

const UVSym = ({x,y,h,color}) => (
  <g>
    <rect x={x-8} y={y} width={16} height={h} fill={color+"15"} stroke={color} strokeWidth="2" rx="2"/>
    <line x1={x} y1={y+4} x2={x} y2={y+h-4} stroke={color} strokeWidth="2.5"/>
    {[-8,-4,0,4,8].map(dx=>(
      <line key={dx} x1={x} y1={y+h/2} x2={x+dx} y2={y+h/2+(dx>0?-7:7)} stroke={color} strokeWidth="1" opacity="0.6"/>
    ))}
    <text x={x} y={y+h+13} textAnchor="middle" fontSize="8" fill={color} fontFamily={T.mono}>UV</text>
  </g>
);

const HeatWheel = ({cx,cy,r=32,color}) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={color+"10"} stroke={color} strokeWidth="2.5"/>
    <circle cx={cx} cy={cy} r={r*.38} fill="none" stroke={color} strokeWidth="1.5"/>
    {[0,60,120,180,240,300].map(a=>{
      const rd=a*Math.PI/180;
      return <line key={a} x1={cx+Math.cos(rd)*r*.4} y1={cy+Math.sin(rd)*r*.4}
        x2={cx+Math.cos(rd)*r*.9} y2={cy+Math.sin(rd)*r*.9} stroke={color} strokeWidth="2"/>;
    })}
    <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill={color} fontFamily={T.mono} fontWeight="700">ERV</text>
  </g>
);

const PlateHX = ({x,y,w,h,color}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={color+"10"} stroke={color} strokeWidth="2" rx="2"/>
    {[1,2,3,4,5].map(i=>(
      <line key={i} x1={x+i*w/6} y1={y} x2={x+i*w/6} y2={y+h} stroke={color} strokeWidth="1.2" opacity="0.45"/>
    ))}
    <line x1={x} y1={y} x2={x+w} y2={y+h} stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <text x={x+w/2} y={y+h/2+4} textAnchor="middle" fontSize="8" fill={color} fontFamily={T.mono} fontWeight="700">PLATE HX</text>
  </g>
);

const SensorTag = ({x,y,label,color,on,onClick}) => (
  <g style={{cursor:"pointer"}} onClick={onClick}>
    <rect x={x-22} y={y-11} width={44} height={22} rx="3"
      fill={on?color+"18":T.panel} stroke={on?color:T.border2} strokeWidth={on?2:1}/>
    <text x={x} y={y+4} textAnchor="middle" fontSize={label.length>5?7:8.5}
      fill={on?color:T.muted} fontFamily={T.mono} fontWeight={on?"700":"400"}>{label}</text>
  </g>
);

const VFDBox = ({cx,y,label,on,color,onClick}) => (
  <g style={{cursor:"pointer"}} onClick={onClick}>
    <rect x={cx-28} y={y} width={56} height={28} rx="3"
      fill={on?color+"18":T.panel} stroke={on?color:T.border2} strokeWidth={on?2:1.5}/>
    <text x={cx} y={y+12} textAnchor="middle" fontSize="9" fill={on?color:T.muted} fontFamily={T.mono} fontWeight="700">VFD</text>
    <text x={cx} y={y+23} textAnchor="middle" fontSize="7.5" fill={on?color+"aa":T.dim} fontFamily={T.mono}>{label}</text>
    {on && <line x1={cx} y1={y+28} x2={cx} y2={y+46} stroke={color} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5"/>}
  </g>
);

const COOLING_PRIORITY = ["clg-valve", "clg-valve-2pos", "clg-dx-staged"];
const HEATING_PRIORITY = ["htg-valve", "htg-valve-2pos", "htg-valve-incr", "elec-heat", "htg-steam-valve"];
const PREHEAT_PRIORITY = ["ph-valve", "ph-valve-2pos", "ph-steam-valve"];
const SUPPLY_FAN_PRIORITY = ["vfd-sf", "sf-starter"];
const RETURN_FAN_PRIORITY = ["vfd-rf", "rf-starter"];

const getAhuToggleId = (selected, visibleComponents, priority) => {
  const selectedIds = new Set(selected.map(entry => entry.id));
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  return (
    priority.find(id => selectedIds.has(id) && visibleIds.has(id)) ||
    priority.find(id => visibleIds.has(id)) ||
    priority[0]
  );
};

function AHUSchematic({cfg, visibleComponents, selected, onToggle}) {
  const on = id => selected.some(s => s.id === id);
  const cc = CAT_COLOR;
  const {ahuType, fanCfg, retCfg, minOA, heatRecoveryType} = cfg;

  const isMixed = ahuType==="mixed";
  const isDOAS  = ahuType==="doas";
  const isWheel = heatRecoveryType==="wheel";
  const isPlate = heatRecoveryType==="plate";
  const isRAC   = heatRecoveryType==="run-around";
  const isERV   = isWheel||isPlate||isRAC;
  const hasRet  = !isDOAS && retCfg!=="none";
  const dualSF  = fanCfg==="dual"||fanCfg==="wall";
  const dualRF  = retCfg==="dual";

  const W=820, H=430, DY=195, DH=28, TOP=DY-DH, BOT=DY+DH;
  const off = isERV ? 85 : 0;

  const X = {
    ductStart: isMixed ? 152 : 60+off,
    preFltr:   isMixed ? 168 : 78+off,
    preheat:   isMixed ? 222 : 132+off,
    uv:        isMixed ? 278 : 188+off,
    frz:       isMixed ? 322 : 232+off,
    clg:       isMixed ? 370 : 280+off,
    htg:       isMixed ? 430 : 340+off,
    sf:        isMixed ? 498 : 408+off,
    finFltr:   isMixed ? 558 : 468+off,
    saEnd:     isMixed ? 618 : 528+off,
    raStart:   isMixed ? 558 : 468+off,
    ddcX:      740,
  };

  const tagAbove = (id,label,xp) => {
    const comp = AHU_COMPS.find(c=>c.id===id);
    const color = comp ? cc[comp.cat]||T.dim : T.dim;
    return (
      <g key={id} style={{cursor:"pointer"}} onClick={()=>onToggle(id)} opacity={on(id)?1:0.3}>
        <line x1={xp} y1={TOP} x2={xp} y2={TOP-30} stroke={on(id)?color:T.dim} strokeWidth="1.5"/>
        <SensorTag x={xp} y={TOP-42} label={label} color={color} on={on(id)} onClick={()=>onToggle(id)}/>
      </g>
    );
  };

  const tagBelow = (id,label,xp,yOff=0) => {
    const comp = AHU_COMPS.find(c=>c.id===id);
    const color = comp ? cc[comp.cat]||T.dim : T.dim;
    return (
      <g key={id} style={{cursor:"pointer"}} onClick={()=>onToggle(id)} opacity={on(id)?1:0.3}>
        <line x1={xp} y1={BOT+yOff} x2={xp} y2={BOT+30+yOff} stroke={on(id)?color:T.dim} strokeWidth="1.5"/>
        <SensorTag x={xp} y={BOT+42+yOff} label={label} color={color} on={on(id)} onClick={()=>onToggle(id)}/>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%",display:"block"}}>
      <rect width={W} height={H} fill={T.surface}/>
      {Array.from({length:W/20+1}).map((_,i)=>(
        <line key={"v"+i} x1={i*20} y1="0" x2={i*20} y2={H} stroke={T.border} strokeWidth="0.3"/>
      ))}
      {Array.from({length:H/20+1}).map((_,i)=>(
        <line key={"h"+i} x1="0" y1={i*20} x2={W} y2={i*20} stroke={T.border} strokeWidth="0.3"/>
      ))}
      <defs>
        <marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0,0 8,4 0,8" fill={T.text}/>
        </marker>
        <marker id="al" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
          <polygon points="8,0 0,4 8,8" fill={T.text}/>
        </marker>
      </defs>

      {isWheel && (
        <g>
          <text x="10" y={DY-52} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700">OA</text>
          <DuctWall x={28} y={DY-68} w={75} h={24}/>
          <line x1={28} y1={DY-56} x2={50} y2={DY-56} stroke={T.text} strokeWidth="2.5" markerEnd="url(#ar)"/>
          <HeatWheel cx={68} cy={DY} r={36} color={cc.Humidity}/>
          <DuctWall x={28} y={BOT+44} w={75} h={24}/>
          <text x="10" y={BOT+58} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700">EA</text>
          <line x1={103} y1={BOT+56} x2={125} y2={BOT+56} stroke={T.text} strokeWidth="2.5" markerEnd="url(#al)"/>
          <line x1={104} y1={DY-44} x2={X.ductStart} y2={TOP} stroke={T.text} strokeWidth="3"/>
        </g>
      )}
      {isPlate && (
        <g>
          <PlateHX x={28} y={TOP-58} w={72} h={DH*2+58+28} color={cc.Humidity}/>
          <text x="10" y={TOP-20} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700">OA</text>
          <line x1={28} y1={TOP-20} x2={30} y2={TOP-20} stroke={T.text} strokeWidth="2.5" markerEnd="url(#ar)"/>
          <text x="10" y={BOT+24} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700">EA</text>
          <line x1={100} y1={BOT+24} x2={122} y2={BOT+24} stroke={T.text} strokeWidth="2.5" markerEnd="url(#al)"/>
          <line x1={100} y1={TOP-20} x2={X.ductStart} y2={TOP} stroke={T.text} strokeWidth="3"/>
        </g>
      )}
      {isRAC && (
        <g>
          <Coil x={26} y={TOP-55} w={50} h={26} color={cc.Humidity} label="RAC-PHT"/>
          <Coil x={26} y={BOT+32} w={50} h={26} color={cc.Humidity} label="RAC-CLG"/>
          <path d={`M 51 ${TOP-29} C 96 ${TOP-29} 96 ${BOT+45} 51 ${BOT+45}`}
            fill="none" stroke={cc.Humidity} strokeWidth="1.5" strokeDasharray="5 3"/>
          <text x="10" y={DY+4} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700">OA</text>
          <line x1={28} y1={DY} x2={X.ductStart} y2={DY} stroke={T.text} strokeWidth="3" markerEnd="url(#ar)"/>
          <line x1={X.ductStart} y1={DY} x2={X.ductStart} y2={TOP} stroke={T.text} strokeWidth="3"/>
        </g>
      )}

      {isMixed && (
        <g>
          <text x="10" y={DY+4} fontSize="12" fill={T.text} fontFamily={T.mono} fontWeight="700">OA</text>
          <line x1={32} y1={DY} x2={78} y2={DY} stroke={T.text} strokeWidth="3" markerEnd="url(#ar)"/>
          {minOA && (
            <g>
              <line x1={54} y1={DY} x2={54} y2={DY+52} stroke={T.text} strokeWidth="2.5"/>
              <g style={{cursor:"pointer"}} onClick={()=>onToggle("min-oa-d")} opacity={on("min-oa-d")?1:0.35}>
                <Damper cx={54} cy={DY+33} sz={11} color={on("min-oa-d")?cc.Actuators:T.dim}/>
              </g>
              <text x={54} y={DY+68} textAnchor="middle" fontSize="8" fill={T.muted} fontFamily={T.mono}>MIN OA</text>
            </g>
          )}
          <rect x={78} y={TOP-5} width={64} height={DH*2+10} rx="2"
            fill={T.blueFaint} stroke={T.blue} strokeWidth="1.5"/>
          <text x={110} y={DY+4} textAnchor="middle" fontSize="8" fill={T.blueL} fontFamily={T.mono} fontWeight="700">MIXING</text>
          <g style={{cursor:"pointer"}} onClick={()=>onToggle("oa-damper")} opacity={on("oa-damper")?1:0.35}>
            <Damper cx={94} cy={DY} sz={11} color={on("oa-damper")?cc.Actuators:T.dim}/>
          </g>
          <line x1={110} y1={BOT+5} x2={110} y2={BOT+52} stroke={T.text} strokeWidth="3"/>
          <g style={{cursor:"pointer"}} onClick={()=>onToggle("ra-damper")} opacity={on("ra-damper")?1:0.35}>
            <Damper cx={110} cy={BOT+30} sz={11} color={on("ra-damper")?cc.Actuators:T.dim}/>
          </g>
          <line x1={38} y1={BOT+52} x2={110} y2={BOT+52} stroke={T.text} strokeWidth="3"/>
          <line x1={12} y1={BOT+52} x2={38} y2={BOT+52} stroke={T.text} strokeWidth="3" markerEnd="url(#al)"/>
          <text x="8" y={BOT+56} fontSize="11" fill={T.text} fontFamily={T.mono} fontWeight="700" textAnchor="end">EA</text>
          <g style={{cursor:"pointer"}} onClick={()=>onToggle("ea-damper")} opacity={on("ea-damper")?1:0.35}>
            <Damper cx={38} cy={BOT+52} sz={11} color={on("ea-damper")?cc.Actuators:T.dim}/>
          </g>
        </g>
      )}
      {!isMixed && !isERV && (
        <g>
          <text x="10" y={DY+4} fontSize="12" fill={T.text} fontFamily={T.mono} fontWeight="700">OA</text>
          <line x1={34} y1={DY} x2={X.ductStart} y2={DY} stroke={T.text} strokeWidth="3" markerEnd="url(#ar)"/>
          <line x1={X.ductStart} y1={DY} x2={X.ductStart} y2={TOP} stroke={T.text} strokeWidth="3"/>
        </g>
      )}

      <DuctWall x={X.ductStart} y={TOP} w={X.finFltr-X.ductStart+8} h={DH*2}/>

      <g style={{cursor:"pointer"}} onClick={()=>onToggle("filter-dp")} opacity={on("filter-dp")?1:0.3}>
        <FilterSym x={X.preFltr} y={TOP} h={DH*2} color={on("filter-dp")?cc.Pressure:T.dim} label="PRE-FLT"/>
      </g>
      <g style={{cursor:"pointer"}} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, PREHEAT_PRIORITY))} opacity={PREHEAT_PRIORITY.some(id => on(id))?1:0.3}>
        <Coil x={X.preheat-18} y={TOP+4} w={36} h={DH*2-8} color={PREHEAT_PRIORITY.some(id => on(id))?cc.Actuators:T.dim} label="PH-HX"/>
      </g>
      <g style={{cursor:"pointer"}} onClick={()=>onToggle("uv-light")} opacity={on("uv-light")?1:0.3}>
        <UVSym x={X.uv} y={TOP+2} h={DH*2-4} color={on("uv-light")?CAT_COLOR.Humidity:T.dim}/>
      </g>
      <g style={{cursor:"pointer"}} onClick={()=>onToggle("freeze")} opacity={on("freeze")?1:0.3}>
        <rect x={X.frz-16} y={TOP+5} width={32} height={DH*2-10} rx="2"
          fill={on("freeze")?"#FFF1F2":T.panel} stroke={on("freeze")?cc.Safety:T.dim} strokeWidth={on("freeze")?2:1.5}/>
        <text x={X.frz} y={DY+4} textAnchor="middle" fontSize="8"
          fill={on("freeze")?cc.Safety:T.dim} fontFamily={T.mono} fontWeight="700">FRZ</text>
      </g>
      <g style={{cursor:"pointer"}} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, COOLING_PRIORITY))} opacity={COOLING_PRIORITY.some(id => on(id))?1:0.3}>
        <Coil x={X.clg-22} y={TOP+3} w={44} h={DH*2-6} color={COOLING_PRIORITY.some(id => on(id))?"#0891B2":T.dim} label="CLG"/>
      </g>
      {COOLING_PRIORITY.some(id => on(id)) && (
        <g opacity="0.7">
          <line x1={X.clg-8} y1={BOT} x2={X.clg-8} y2={BOT+38} stroke="#0891B2" strokeWidth="1.5"/>
          <line x1={X.clg+8} y1={BOT} x2={X.clg+8} y2={BOT+38} stroke="#0891B2" strokeWidth="1.5" strokeDasharray="4 2"/>
          <text x={X.clg-8} y={BOT+50} textAnchor="middle" fontSize="7" fill="#0891B2" fontFamily={T.mono}>CHWS</text>
          <text x={X.clg+8} y={BOT+50} textAnchor="middle" fontSize="7" fill="#0891B2" fontFamily={T.mono}>CHWR</text>
        </g>
      )}
      <g style={{cursor:"pointer"}} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, HEATING_PRIORITY))} opacity={HEATING_PRIORITY.some(id => on(id))?1:0.3}>
        <Coil x={X.htg-20} y={TOP+3} w={40} h={DH*2-6} color={HEATING_PRIORITY.some(id => on(id))?T.amber:T.dim} label="HHX"/>
      </g>

      {dualSF ? (
        <g>
          <VFDBox cx={X.sf-14} y={108} label="SF-01" on={SUPPLY_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, SUPPLY_FAN_PRIORITY))}/>
          <VFDBox cx={X.sf+22} y={108} label="SF-02" on={SUPPLY_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, SUPPLY_FAN_PRIORITY))}/>
          <Fan cx={X.sf-14} cy={DY} r={17} color={SUPPLY_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
          <Fan cx={X.sf+22} cy={DY} r={17} color={SUPPLY_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
        </g>
      ) : (
        <g>
          <VFDBox cx={X.sf} y={108} label="SF-01" on={SUPPLY_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, SUPPLY_FAN_PRIORITY))}/>
          <Fan cx={X.sf} cy={DY} r={20} color={SUPPLY_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
        </g>
      )}

      <g style={{cursor:"pointer"}} onClick={()=>onToggle("filter-dp")} opacity={on("filter-dp")?1:0.3}>
        <FilterSym x={X.finFltr} y={TOP} h={DH*2} color={on("filter-dp")?cc.Pressure:T.dim} label="FNL-FLT"/>
      </g>

      <line x1={X.finFltr+8} y1={TOP} x2={X.saEnd} y2={TOP} stroke={T.text} strokeWidth="3"/>
      <line x1={X.finFltr+8} y1={BOT} x2={X.saEnd} y2={BOT} stroke={T.text} strokeWidth="3"/>
      <line x1={X.saEnd} y1={TOP} x2={X.saEnd+26} y2={DY} stroke={T.text} strokeWidth="3"/>
      <line x1={X.saEnd} y1={BOT} x2={X.saEnd+26} y2={DY} stroke={T.text} strokeWidth="3"/>
      <line x1={X.saEnd+26} y1={DY} x2={X.saEnd+52} y2={DY} stroke={T.text} strokeWidth="3" markerEnd="url(#ar)"/>
      <text x={X.saEnd+56} y={DY+4} fontSize="12" fill={T.text} fontFamily={T.mono} fontWeight="700">SA</text>

      {hasRet && (
        <g>
          <text x={X.raStart+72} y={BOT+84} fontSize="12" fill={T.text} fontFamily={T.mono} fontWeight="700">RA</text>
          <line x1={X.raStart+72} y1={BOT+80} x2={X.raStart+46} y2={BOT+80} stroke={T.text} strokeWidth="3" markerEnd="url(#al)"/>
          <DuctWall x={isMixed?110:X.ductStart} y={BOT+66} w={X.raStart+26-(isMixed?110:X.ductStart)} h={28}/>
          {dualRF ? (
            <g>
              <VFDBox cx={X.raStart-14} y={BOT+28} label="RF-01" on={RETURN_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, RETURN_FAN_PRIORITY))}/>
              <VFDBox cx={X.raStart+22} y={BOT+28} label="RF-02" on={RETURN_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, RETURN_FAN_PRIORITY))}/>
              <Fan cx={X.raStart-14} cy={BOT+80} r={16} color={RETURN_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
              <Fan cx={X.raStart+22} cy={BOT+80} r={16} color={RETURN_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
            </g>
          ) : retCfg==="single" ? (
            <g>
              <VFDBox cx={X.raStart} y={BOT+28} label="RF-01" on={RETURN_FAN_PRIORITY.some(id => on(id))} color={cc.Drives} onClick={()=>onToggle(getAhuToggleId(selected, visibleComponents, RETURN_FAN_PRIORITY))}/>
              <Fan cx={X.raStart} cy={BOT+80} r={18} color={RETURN_FAN_PRIORITY.some(id => on(id))?cc.Drives:T.dim}/>
            </g>
          ) : null}
          {tagBelow("smoke-ra","RA-SD",X.raStart-80,66)}
          {tagBelow("ra-temp", "RA-T", X.raStart-58,66)}
          {tagBelow("ra-rh",   "RA-H", X.raStart-36,66)}
          {tagBelow("ra-static","RA-SP",X.raStart-14,66)}
        </g>
      )}

      {tagAbove("oa-temp",  "OA-T",  isMixed?54:X.ductStart+18)}
      {tagAbove("oa-rh",    "OA-H",  isMixed?78:X.ductStart+42)}
      {isMixed && tagAbove("ma-temp","MA-T", X.preFltr+30)}
      {tagAbove("smoke-sa", "SA-SD", X.finFltr-36)}
      {tagAbove("sa-temp",  "SA-T",  X.saEnd-26)}
      {tagAbove("sa-rh",    "SA-H",  X.saEnd-4)}
      {tagAbove("sa-static","SA-SP", X.saEnd+20)}
      {tagAbove("bldg-sp",  "BLD-P", X.saEnd+44)}
      {tagBelow("hw-sup-t","HWS-T",X.htg-12)}
      {tagBelow("hw-ret-t","HWR-T",X.htg+12)}

      <g style={{cursor:"pointer"}} onClick={()=>onToggle("ddc-panel")}>
        <rect x={X.ddcX} y={DY-34} width={72} height={68} rx="4"
          fill={on("ddc-panel")?T.blueFaint:T.panel}
          stroke={on("ddc-panel")?T.blue:T.border2}
          strokeWidth={on("ddc-panel")?2:1.5}/>
        <text x={X.ddcX+36} y={DY-14} textAnchor="middle" fontSize="10"
          fill={on("ddc-panel")?T.blue:T.muted} fontFamily={T.mono} fontWeight="700">DDC</text>
        <text x={X.ddcX+36} y={DY+2}  textAnchor="middle" fontSize="7.5"
          fill={on("ddc-panel")?T.blueL:T.dim} fontFamily={T.mono}>CONTROL</text>
        <text x={X.ddcX+36} y={DY+14} textAnchor="middle" fontSize="7.5"
          fill={on("ddc-panel")?T.blueL:T.dim} fontFamily={T.mono}>PANEL</text>
        <text x={X.ddcX+36} y={DY+26} textAnchor="middle" fontSize="7.5"
          fill={on("ddc-panel")?T.blueL:T.dim} fontFamily={T.mono}>BACnet</text>
        {on("ddc-panel") && (
          <line x1={X.ddcX} y1={DY} x2={X.saEnd+56} y2={DY}
            stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" opacity="0.4"/>
        )}
      </g>
      <g style={{cursor:"pointer"}} onClick={()=>onToggle("homerun")} opacity={on("homerun")?1:0.3}>
        <SensorTag x={X.ddcX+36} y={DY+52} label="HOME-RUN"
          color={on("homerun")?T.steel:T.dim} on={on("homerun")} onClick={()=>onToggle("homerun")}/>
      </g>

      <text x="10" y={H-8} fontSize="7.5" fill={T.faint} fontFamily={T.mono}>
        {AHU_TYPES.find(t=>t.id===ahuType)?.label} · {FAN_CONFIGS.find(f=>f.id===fanCfg)?.label} · Click tags to toggle
      </text>
    </svg>
  );
}

function ConfigField({ label, value, options, onChange, disabled = false }) {
  return (
    <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <span style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.muted, fontFamily:T.mono }}>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          width:"100%",
          padding:"6px 8px",
          border:"1px solid "+(disabled ? T.border : T.border2),
          borderRadius:5,
          background:disabled ? T.panel : T.bg,
          color:disabled ? T.dim : T.text,
          fontSize:12,
          fontFamily:T.mono,
          outline:"none",
        }}
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

const labelFor = (options, id) => options.find(option => option.id === id)?.label || id;

function getAhuTypeSelectValue(cfg) {
  if (cfg.ahuType === "doas" && cfg.heatRecoveryType === "wheel") return "erv-wheel";
  if (cfg.ahuType === "doas" && cfg.heatRecoveryType === "plate") return "erv-plate";
  if (cfg.ahuType === "mixed" && cfg.heatRecoveryType === "run-around") return "erv-rac";
  return cfg.ahuType;
}

function AhuPrimaryCfgFields({ cfg, onCfgChange, columns = "1fr 1fr" }) {
  const ahuTypeValue = getAhuTypeSelectValue(cfg);
  const showReturnFanSpeed = cfg.returnFanConfig !== "none";
  const showPreheat = cfg.ahuType === "doas";

  return (
    <div style={{ display:"grid", gridTemplateColumns:columns, gap:8 }}>
      <ConfigField
        label="AHU Type"
        value={ahuTypeValue}
        options={AHU_TYPES}
        onChange={value => onCfgChange("ahuType", value)}
      />
      <ConfigField
        label="Supply Fan"
        value={cfg.supplyFanType}
        options={AHU_SUPPLY_FAN_TYPES}
        onChange={value => onCfgChange("supplyFanType", value)}
      />
      <ConfigField
        label="Return Fan"
        value={cfg.returnFanConfig}
        options={RETURN_CONFIGS}
        onChange={value => onCfgChange("returnFanConfig", value)}
      />
      {showReturnFanSpeed && (
        <ConfigField
          label="Return Fan Speed"
          value={cfg.returnFanType}
          options={AHU_RETURN_FAN_TYPES}
          onChange={value => onCfgChange("returnFanType", value)}
        />
      )}
      <ConfigField
        label="Economizer"
        value={cfg.economizer}
        options={AHU_ECONOMIZER_TYPES}
        onChange={value => onCfgChange("economizer", value)}
      />
      <ConfigField
        label="Cooling"
        value={cfg.coolingType}
        options={AHU_COOLING_TYPES}
        onChange={value => onCfgChange("coolingType", value)}
      />
      <ConfigField
        label="Heating"
        value={cfg.heatingType}
        options={AHU_HEATING_TYPES}
        onChange={value => onCfgChange("heatingType", value)}
      />
      <ConfigField
        label="Heat Recovery"
        value={cfg.heatRecoveryType}
        options={AHU_HEAT_RECOVERY_TYPES}
        onChange={value => onCfgChange("heatRecoveryType", value)}
      />
      {showPreheat && (
        <ConfigField
          label="Preheat"
          value={cfg.preheatType}
          options={AHU_PREHEAT_TYPES}
          onChange={value => onCfgChange("preheatType", value)}
        />
      )}
    </div>
  );
}

function AhuConfigLauncher({ cfg, onCfgChange, onStart }) {
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"28px 24px 40px" }}>
      <div style={{ maxWidth:980, margin:"0 auto" }}>
        <div style={{
          marginBottom:18,
          padding:"16px 18px",
          borderRadius:12,
          border:"1px solid "+T.blueMid,
          background:T.blueFaint,
        }}>
          <div style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.blue, fontFamily:T.mono, marginBottom:4 }}>
            AHU Configuration
          </div>
          <div style={{ fontSize:26, fontWeight:800, color:T.text, marginBottom:6 }}>
            Configure AHU
          </div>
          <div style={{ fontSize:13, color:T.muted }}>
            Select the primary AHU configuration first, then open the full schematic editor.
          </div>
        </div>

        <div style={{
          marginBottom:14,
          padding:"12px 14px",
          background:T.surface,
          border:"1px solid "+T.border,
          borderRadius:10,
          display:"flex",
          alignItems:"center",
          gap:10,
          flexWrap:"wrap",
        }}>
          <div style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.muted, fontFamily:T.mono }}>
            Summary
          </div>
          <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>
            {labelFor(AHU_TYPES, getAhuTypeSelectValue(cfg))} · {labelFor(AHU_SUPPLY_FAN_TYPES, cfg.supplyFanType)} supply · {labelFor(RETURN_CONFIGS, cfg.returnFanConfig)} return · {labelFor(AHU_COOLING_TYPES, cfg.coolingType)} cooling · {labelFor(AHU_HEATING_TYPES, cfg.heatingType)} heating
          </div>
        </div>

        <div style={{
          padding:"18px",
          background:T.surface,
          border:"1px solid "+T.border,
          borderRadius:12,
          boxShadow:"0 18px 40px rgba(15,23,42,0.08)",
        }}>
          <AhuPrimaryCfgFields cfg={cfg} onCfgChange={onCfgChange} />
        </div>

        <div style={{ marginTop:18, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, color:T.muted }}>
            The full AHU diagram editor will open using this normalized cfg.
          </div>
          <button
            onClick={onStart}
            style={{
              padding:"12px 18px",
              border:"none",
              borderRadius:8,
              background:T.blue,
              color:"#fff",
              fontWeight:800,
              cursor:"pointer",
              fontFamily:T.mono,
              fontSize:13,
              boxShadow:"0 12px 24px rgba(37,99,235,0.24)",
            }}
          >
            Start AHU Editor
          </button>
        </div>
      </div>
    </div>
  );
}


function CompPanel({cfg, visibleComponents, selected,onToggle,onSetCompQty,custom,onAddCust,onRemoveCust,installType,setIT,qty,setQty}) {
  const [filterCat,setFC]   = useState("All");
  const [expanded,setExp]   = useState(null);
  const [modal,setModal]    = useState(false);
  const cats = ["All",...Object.keys(CAT_COLOR)];
  const applicable = visibleComponents;
  const visible = filterCat==="All" ? applicable : applicable.filter(c=>c.cat===filterCat);

  const getAsmCost = (comp) => {
    const aid = installType==="EMT" ? comp.emtAID : comp.plnAID;
    if (!aid) return {mtl:comp.unitMtl||0, lbr:comp.unitLbr||0, items:[]};
    const result = calcAssembly(aid);
    const asm = ASSEMBLIES[aid];
    return {...result, items: asm?.items||[]};
  };

  const isOnP    = id => selected.some(s => s.id === id);
  const getQtyP  = id => selected.find(s => s.id === id)?.qty ?? 1;
  const selComps = applicable.filter(c=>isOnP(c.id));
  const custMtl = custom.reduce((a,c)=>a+(c.unitMtl+c.extraMtl),0);
  const custLbr = custom.reduce((a,c)=>a+(c.unitLbr+c.extraLbr),0);
  const unitMtl = selComps.reduce((a,c)=>a+getAsmCost(c).mtl*getQtyP(c.id),0)+custMtl;
  const unitLbr = selComps.reduce((a,c)=>a+getAsmCost(c).lbr*getQtyP(c.id),0)+custLbr;
  const divFor = per => per==='C'?100:per==='M'?1000:1;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{padding:"12px 14px 10px",borderBottom:"1px solid "+T.border}}>
        <div style={{fontSize:10,color:T.muted,fontFamily:T.mono,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>Air Handler</div>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:8}}>{AHU_TYPES.find(t=>t.id===cfg.ahuType)?.label}</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 10px",
          background:T.blueFaint,borderRadius:5,border:"1px solid "+T.blueMid}}>
          <span style={{fontSize:11,color:T.blue,fontFamily:T.mono,letterSpacing:1,textTransform:"uppercase"}}>Typical ×</span>
          <input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
            style={{width:52,padding:"4px 6px",border:"1px solid "+T.blueMid,borderRadius:4,
              fontSize:14,fontFamily:T.mono,background:T.surface,color:T.blue,fontWeight:700,outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:11,color:T.muted}}>{qty===1?"unit":"units"}</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["Plenum","EMT"].map(tt=>(
            <button key={tt} onClick={()=>setIT(tt)} style={{
              flex:1,padding:"4px 0",borderRadius:4,
              border:"1px solid "+(installType===tt?T.blue:T.border2),
              background:installType===tt?T.blueFaint:"transparent",
              color:installType===tt?T.blue:T.muted,
              fontSize:11,fontFamily:T.mono,cursor:"pointer",fontWeight:installType===tt?700:400}}>
              {tt}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"6px 10px",borderBottom:"1px solid "+T.border,display:"flex",gap:3,flexWrap:"wrap",alignItems:"center"}}>
        {cats.map(cat=>{
          const color=CAT_COLOR[cat]||T.steel;
          const active=filterCat===cat;
          return (
            <button key={cat} onClick={()=>setFC(cat)} style={{
              padding:"2px 7px",borderRadius:10,fontSize:9.5,fontFamily:T.mono,cursor:"pointer",
              border:"1px solid "+(active?color:T.border),
              background:active?color+"14":"transparent",color:active?color:T.muted}}>
              {cat}
            </button>
          );
        })}
        <div style={{marginLeft:"auto",display:"flex",gap:3}}>
          <button onClick={()=>setSel(sel=>{const next=[...sel];for(const c of visible){if(!next.some(s=>s.id===c.id))next.push({id:c.id,qty:1});}return next;})} style={{padding:"2px 7px",borderRadius:10,fontSize:9.5,fontFamily:T.mono,cursor:"pointer",border:"1px solid "+T.border,background:"transparent",color:T.muted}}>All</button>
          <button onClick={()=>setSel(sel=>sel.filter(s=>!visible.some(c=>c.id===s.id)))} style={{padding:"2px 7px",borderRadius:10,fontSize:9.5,fontFamily:T.mono,cursor:"pointer",border:"1px solid "+T.border,background:"transparent",color:T.muted}}>None</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {visible.map(comp=>{
          const isOn    = selected.some(s => s.id === comp.id);
          const compQty = selected.find(s => s.id === comp.id)?.qty ?? 1;
          const isExp = expanded===comp.id;
          const color = CAT_COLOR[comp.cat]||T.steel;
          const cost  = getAsmCost(comp);

          return (
            <div key={comp.id} style={{borderBottom:"1px solid "+T.border,
              borderLeft:"3px solid "+(isOn?color:"transparent"),
              background:isOn?color+"08":T.surface}}>
              <div style={{padding:"8px 13px",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}
                onClick={()=>onToggle(comp.id)}>
                <div style={{width:14,height:14,borderRadius:3,flexShrink:0,
                  background:isOn?color:"transparent",border:"2px solid "+(isOn?color:T.border2),
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {isOn && <span style={{color:"#fff",fontSize:9,fontWeight:900,lineHeight:1}}>✓</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:isOn?T.text:T.muted,fontWeight:isOn?600:400}}>{comp.name}</div>
                  <div style={{fontSize:10,color:isOn?color:T.dim,fontFamily:T.mono,marginTop:1}}>{comp.cat}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,color:isOn?T.text:T.muted,fontFamily:T.mono}}>{fmt$(cost.mtl*compQty)}</div>
                  <div style={{fontSize:10,color:T.dim,fontFamily:T.mono}}>{fmtHr(cost.lbr*compQty)}</div>
                </div>
                {isOn && (
                  <input type="number" min="1" value={compQty}
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>onSetCompQty(comp.id, parseInt(e.target.value)||1)}
                    style={{ width:36, padding:"2px 4px", border:"1px solid "+T.blueMid,
                      borderRadius:3, fontSize:11, fontFamily:T.mono, background:T.blueFaint,
                      color:T.blue, fontWeight:700, outline:"none", textAlign:"center" }} />
                )}
                {isOn && (
                  <button onClick={e=>{e.stopPropagation();setExp(isExp?null:comp.id);}}
                    style={{background:"none",border:"none",color:T.dim,cursor:"pointer",
                      fontSize:11,padding:"0 2px",lineHeight:1,marginLeft:2}}>
                    {isExp?"▲":"▼"}
                  </button>
                )}
              </div>

              {isOn && isExp && cost.items.length>0 && (
                <div style={{background:color+"06",borderTop:"1px solid "+color+"20",padding:"4px 8px 8px 8px"}}>
                  <div style={{fontSize:9,color,fontFamily:T.mono,letterSpacing:1.5,
                    textTransform:"uppercase",marginBottom:4,paddingLeft:4}}>Parts</div>
                  {cost.items.map((it,i)=>{
                    const itemMtl = it.qty * it.mtlUnit / divFor(it.mtlPer);
                    const itemHrs = it.qty * it.hrsUnit / divFor(it.hrsPer);
                    return (
                      <div key={i} style={{display:"flex",alignItems:"baseline",gap:6,
                        padding:"2px 4px",borderRadius:3,
                        background:i%2===0?"transparent":T.faint}}>
                        <span style={{fontSize:9,color:T.dim,fontFamily:T.mono,width:28,flexShrink:0}}>
                          {it.qty}{it.mtlPer==='C'?'/C':it.mtlPer==='M'?'/M':''}
                        </span>
                        <span style={{fontSize:10,color:T.muted,flex:1,minWidth:0,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {UNIT_ITEMS[it.item]?.desc||it.item}
                        </span>
                        <span style={{fontSize:10,color:T.steel,fontFamily:T.mono,flexShrink:0}}>
                          {fmt$(itemMtl)} · {fmtHr(itemHrs)}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",
                    marginTop:5,paddingTop:5,borderTop:"1px solid "+color+"30"}}>
                    <span style={{fontSize:9,color:T.muted,fontFamily:T.mono}}>TOTAL</span>
                    <span style={{fontSize:11,color,fontFamily:T.mono,fontWeight:700}}>
                      {fmt$(cost.mtl)} · {fmtHr(cost.lbr)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {(filterCat==="All"||filterCat==="Custom") && custom.map(comp=>{
          const color=CAT_COLOR.Custom;
          return (
            <div key={comp.id} style={{padding:"8px 13px",background:color+"08",
              borderBottom:"1px solid "+T.border,borderLeft:"3px solid "+color}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:14,height:14,borderRadius:3,background:color+"20",
                  border:"2px solid "+color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:9,color,fontWeight:900}}>+</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text,display:"flex",alignItems:"center",gap:4}}>
                    {comp.name}
                    <span style={{fontSize:8,color,background:color+"14",padding:"1px 4px",borderRadius:3,fontFamily:T.mono}}>CUSTOM</span>
                  </div>
                  <div style={{fontSize:10,color:T.muted,fontFamily:T.mono}}>{comp.category}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,fontFamily:T.mono}}>{fmt$(comp.unitMtl+comp.extraMtl)}</div>
                  <div style={{fontSize:10,color:T.dim,fontFamily:T.mono}}>{fmtHr(comp.unitLbr+comp.extraLbr)}</div>
                </div>
                <button onClick={()=>onRemoveCust(comp.id)}
                  style={{background:"none",border:"none",color:T.dim,cursor:"pointer",fontSize:15,padding:"0 2px"}}>×</button>
              </div>
              {comp.notes && <div style={{fontSize:10,color:T.muted,marginTop:3,marginLeft:21,fontStyle:"italic"}}>{comp.notes}</div>}
            </div>
          );
        })}

        <div style={{padding:"10px 13px"}}>
          <button onClick={()=>setModal(true)} style={{width:"100%",padding:"7px",
            border:"1px dashed "+T.border2,borderRadius:5,background:"none",
            color:T.muted,cursor:"pointer",fontSize:11,fontFamily:T.mono,
            display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span style={{fontSize:14,color:T.blue}}>+</span>Add custom component…
          </button>
        </div>
      </div>

      <div style={{padding:"10px 13px",borderTop:"1px solid "+T.border,background:T.panel}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          marginBottom:6,padding:"5px 8px",background:T.surface,borderRadius:4,border:"1px solid "+T.border}}>
          <span style={{fontSize:10,color:T.muted,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:1}}>Per unit</span>
          <span style={{fontSize:12,fontFamily:T.mono}}>
            <span style={{color:T.blue,fontWeight:700}}>{fmt$(unitMtl)}</span>
            <span style={{color:T.dim,marginLeft:10}}>{fmtHr(unitLbr)}</span>
          </span>
        </div>
        {qty>1 && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"7px 10px",background:T.blueFaint,borderRadius:5,border:"1px solid "+T.blueMid}}>
            <span style={{fontSize:11,color:T.blue,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:1}}>Total × {qty}</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:15,color:T.blue,fontFamily:T.mono,fontWeight:700}}>{fmt$(unitMtl*qty)}</div>
              <div style={{fontSize:11,color:T.blueL,fontFamily:T.mono}}>{fmtHr(unitLbr*qty)}</div>
            </div>
          </div>
        )}
      </div>
      {modal && (
        <AssemblyPickerModal
          title="Add AHU Assembly"
          installType={installType}
          options={toAssemblyOptions(visibleComponents)}
          onAdd={c=>{onAddCust(c);setModal(false);}}
          onClose={()=>setModal(false)}
        />
      )}
    </div>
  );
}

export default function AHUPage() {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const isEditing = !!editingItem && editingItem.type === "ahu";
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const buildInitialCfg = () => (isEditing ? normalizeAhuCfg(editingItem.cfg) : normalizeAhuCfg(DEFAULT_AHU_CFG));
  const buildInitialSelected = (nextCfg) => (
    reconcileAhuSelected(
      isEditing ? (editingItem.selected || []) : [],
      nextCfg,
      { components: getVisibleAhuComponents(nextCfg) }
    )
  );

  const [cfg,setCfg]        = useState(() => buildInitialCfg());
  const [blockedIds,setBlockedIds] = useState([]);
  const [selected,setSel]   = useState(() => buildInitialSelected(buildInitialCfg()));
  const [custom,setCustom]  = useState(() => isEditing ? editingItem.custom||[] : []);
  const [installType,setIT] = useState(() => isEditing ? editingItem.installType : quoteDefault);
  const [qty,setQty]        = useState(() => isEditing ? editingItem.qty : 1);
  const [tag,setTag]        = useState(() => isEditing ? editingItem.tag : "AHU");
  const [loc,setLoc]        = useState(() => isEditing ? editingItem.location : "Mechanical Room");
  const [isLauncherMode, setIsLauncherMode] = useState(() => !isEditing);
  const projectHubSource = useMemo(
    () => resolveProjectHubGraphicsSource("ahu", cfg, selected),
    [cfg, selected]
  );

  const visibleComponents = useMemo(
    () => (cfg ? getVisibleAhuComponents(cfg) : []),
    [cfg]
  );

  const reconcileRanOnce = useRef(false);
  useEffect(() => {
    if (!cfg) return;
    if (!reconcileRanOnce.current) { reconcileRanOnce.current = true; return; }
    setSel(current => reconcileAhuSelected(current, cfg, { components: visibleComponents, blockedIds }));
  }, [cfg, visibleComponents, blockedIds]);

  useEffect(() => {
    const nextCfg = buildInitialCfg();
    setCfg(nextCfg);
    setBlockedIds([]);
    setSel(buildInitialSelected(nextCfg));
    setCustom(isEditing ? editingItem.custom||[] : []);
    setIT(isEditing ? editingItem.installType : quoteDefault);
    setQty(isEditing ? editingItem.qty : 1);
    setTag(isEditing ? editingItem.tag : "AHU");
    setLoc(isEditing ? editingItem.location : "Mechanical Room");
    setIsLauncherMode(!isEditing);
  }, [editingItem?.id, isEditing, quoteDefault]);

  useEffect(() => {
    const draft = subPage?.type === "ahu" ? subPage?.conduitFillDraft : null;
    if (!draft) return;
    if (draft.cfg) setCfg(normalizeAhuCfg(draft.cfg));
    if (draft.selected) setSel(draft.selected);
    if (draft.custom) setCustom(draft.custom);
    if (draft.installType) setIT(draft.installType);
    if (Number.isFinite(Number(draft.qty))) setQty(Math.max(1, Number(draft.qty) || 1));
    if (typeof draft.tag === "string") setTag(draft.tag);
    if (typeof draft.location === "string") setLoc(draft.location);
    setBlockedIds(draft.blockedIds || []);
    setIsLauncherMode(Boolean(draft.isLauncherMode));
  }, [subPage]);

  function handleCfgChange(key, value) {
    setCfg(prev => normalizeAhuCfg({ ...prev, [key]: value }));
  }

  const setCompQty = (id, qty) => setSel(s => s.map(x => x.id===id ? {...x, qty:Math.max(1,qty)} : x));
  const toggle = id => setSel(current => {
    const isSelected = current.some(entry => entry.id === id);
    const isDefaulted = visibleComponents.some(comp => comp.id === id && comp.defaultWhen?.(cfg));

    setBlockedIds(prev => {
      if (isDefaulted && isSelected) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      if (!isSelected) {
        return prev.filter(blockedId => blockedId !== id);
      }
      return prev;
    });

    return toggleAhuComponentSelection(current, id, { components: visibleComponents, cfg });
  });
  const getSelectedQty = id => selected.find(s => s.id === id)?.qty ?? 1;

  const unitMtl = cfg
    ? AHU_COMPS.filter(c=>selected.some(s => s.id === c.id)).reduce((a,c)=>{
        const aid = installType==="EMT" ? c.emtAID : c.plnAID;
        return a + (aid ? calcAssembly(aid).mtl : c.unitMtl||0) * getSelectedQty(c.id);
      },0) + custom.reduce((a,c)=>a+c.unitMtl+c.extraMtl,0)
    : 0;

  if (isLauncherMode) {
    return (
      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 52px)",overflow:"hidden"}}>
        <AhuConfigLauncher
          cfg={cfg}
          onCfgChange={handleCfgChange}
          onStart={() => setIsLauncherMode(false)}
        />
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 52px)",overflow:"hidden"}}>
      <>
          <div style={{padding:"10px 20px",borderBottom:"1px solid "+T.border,
            display:"flex",alignItems:"center",gap:12,background:T.surface,flexShrink:0}}>
            <div style={{padding:"3px 10px",background:T.blueFaint,border:"1px solid "+T.blueMid,borderRadius:4}}>
              <span style={{fontSize:11,color:T.blue,fontFamily:T.mono,fontWeight:700,letterSpacing:1}}>AHU</span>
            </div>
            <input value={tag} onChange={e=>setTag(e.target.value)}
              style={{background:T.blueFaint,border:"1px solid "+T.blueMid,borderRadius:4,
                color:T.blue,fontFamily:T.mono,fontSize:13,padding:"4px 8px",width:80,outline:"none",fontWeight:700}}/>
            {qty>1 && <span style={{fontSize:13,color:T.blue,fontFamily:T.mono}}>× {qty} typical</span>}
            <input value={loc} onChange={e=>setLoc(e.target.value)}
              style={{background:T.panel,border:"1px solid "+T.border,borderRadius:4,
                color:T.steel,fontFamily:T.mono,fontSize:12,padding:"4px 8px",width:160,outline:"none"}}/>
            <span style={{fontSize:11,color:T.blueL,background:T.blueFaint,padding:"2px 8px",
              borderRadius:10,border:"1px solid "+T.blueMid,fontFamily:T.mono}}>
              {AHU_TYPES.find(t=>t.id===getAhuTypeSelectValue(cfg))?.label}
            </span>
            <AddToEstimateBtn type="ahu" tag={tag} location={loc}
              cfg={cfg} selected={selected} custom={custom}
              qty={qty} installType={installType} />
            <div style={{flex:1}}/>
            <div style={{display:"flex",gap:14,padding:"5px 14px",background:T.blueFaint,
              borderRadius:6,border:"1px solid "+T.blueMid}}>
              <span style={{fontFamily:T.mono,fontSize:12,color:T.muted}}>
                Unit <span style={{color:T.blue,fontWeight:700}}>{fmt$(unitMtl)}</span>
              </span>
              {qty>1 && <span style={{fontFamily:T.mono,fontSize:12,color:T.muted}}>
                Total <span style={{color:T.blue,fontWeight:700}}>{fmt$(unitMtl*qty)}</span>
              </span>}
            </div>
          </div>
          <SidebarLayout pageKey="ahu" mobileBadge={fmt$(unitMtl)} main={(
            <div style={{flex:1,padding:"16px 20px",display:"flex",flexDirection:"column",overflow:"hidden",height:"100%"}}>
              <div style={{flex:1,background:T.surface,borderRadius:8,border:"1px solid "+T.border,
                overflow:"hidden",minHeight:0}}>
                <SchematicTabs>{{
                  flow: <AHUSchematic cfg={cfg} visibleComponents={visibleComponents} selected={selected} onToggle={toggle}/>,
                  elec: projectHubSource ? (
                    <ProjectHubOntologyGraphicPanel
                      type="ahu"
                      cfg={cfg}
                      selected={selected}
                    />
                  ) : (
                    <DiagramViewer
                      svgPath="/diagrams/ahu-elec.svg"
                      selectedIds={selected.map(s=>s.id)}
                      allIds={AHU_COMPS.map(c=>c.id)}
                      fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><span style={{color:T.muted,fontFamily:T.mono,fontSize:13}}>Drop ahu-elec.svg into public/diagrams/</span></div>}
                    />
                  ),
                  points: <PointsList comps={AHU_COMPS} selected={selected} installType={installType} tag={tag}/>
                }}</SchematicTabs>
              </div>
              <div style={{marginTop:10,padding:"9px 14px",background:T.blueFaint,
                border:"1px dashed "+T.blueL,borderRadius:5,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:15,color:T.blueL}}>⊕</span>
                <div style={{flex:1,fontSize:12,color:T.blue,fontWeight:500}}>
                  Conduit Fill Calculator
                  <span style={{fontWeight:400,color:T.blueL,marginLeft:8,fontSize:11}}>
                    — home run conduit count from cable ODs
                  </span>
                </div>
                <button
                  onClick={() => {
                    const bundle = buildCableBundleFromPoints(
                      AHU_COMPS.filter(c => selected.some(s => s.id === c.id)),
                      selected
                    );
                    if (!bundle.length) return;
                    sessionStorage.setItem(CONDUIT_FILL_BUNDLE_KEY, JSON.stringify(bundle));
                    sessionStorage.setItem(CONDUIT_FILL_CONTEXT_KEY, JSON.stringify({
                      returnSubPage: editingItem ? { type: "ahu", editItemId: editingItem.id } : { type: "ahu" },
                      homerunId: findHomeRunComponentId(AHU_COMPS),
                      draft: {
                        cfg,
                        selected,
                        custom,
                        installType,
                        qty,
                        tag,
                        location: loc,
                        blockedIds,
                        isLauncherMode,
                      },
                    }));
                    window.dispatchEvent(new CustomEvent("open-conduit-fill"));
                  }}
                  style={{padding:"4px 10px",border:"1px solid "+T.blueL,borderRadius:4,
                  background:"none",color:T.blue,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>
                  Configure →
                </button>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                {AHU_COMPS.filter(c=>selected.some(s=>s.id===c.id)).map(comp=>{
                  const color=CAT_COLOR[comp.cat]||T.steel;
                  return (
                    <div key={comp.id} onClick={()=>toggle(comp.id)} style={{
                      display:"flex",alignItems:"center",gap:4,padding:"2px 8px 2px 5px",
                      background:color+"10",border:"1px solid "+color+"28",borderRadius:12,cursor:"pointer"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:color}}/>
                      <span style={{fontSize:10,color:T.muted}}>{comp.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            )} sidebar={(
              <CompPanel cfg={cfg} visibleComponents={visibleComponents} selected={selected} onToggle={toggle} onSetCompQty={setCompQty}
                custom={custom} onAddCust={c=>setCustom(cs=>[...cs,c])}
                onRemoveCust={id=>setCustom(cs=>cs.filter(c=>c.id!==id))}
                installType={installType} setIT={setIT} qty={qty} setQty={setQty}/>
            )}
          />
      </>
    </div>
  );
}

