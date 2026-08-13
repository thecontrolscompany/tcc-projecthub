/**
 * projectSettings.js
 *
 * Default project-level settings and the four-bucket cost model:
 *   Labor → Material → Overhead → Profit → Bond
 *
 * These settings are stored per-estimate in estimate.settings.
 */

export const DEFAULT_SETTINGS = {
  _v: 1,                   // settings schema version (for migration)
  // ── Rates & markups ─────────────────────────────────────────────────────────
  wageRate:       42.95,   // locked: CCE Regular
  controlsWageRate: 125,    // controls engineering labor rate (programming, commissioning)
  overheadPct:    10,      // % of (labor + material)
  profitPct:      25,      // % of (labor + material + overhead)
  bondPct:         4,      // % of (labor + material + overhead + profit)
  defaultInstallType: "EMT",
  estimateScopeMode: "installation",
  proposalScopeMode: "brief",
  baseScopeName:    "Scope",
  useCustomerScope: false,
  customerScope: "",
  customerScopeImport: null,
  existingHeadEnd: false,  // Turnkey only: customer already has a BAS front-end/supervisory controller — omit the new Supervisory Controller from DDC Infrastructure

  // ── Project info ────────────────────────────────────────────────────────────
  address:        "",
  city:           "",
  state:          "",
  zip:            "",
  team:           "pensacola",    // pensacola | panama-city
  customerContact: "",
  drawingBasis:   "",
  estimateDate:   "",

  // ── Mileage ─────────────────────────────────────────────────────────────────
  milesOneWay:    50,
  mileageRate:    0.70,    // $/mile IRS rate
  trips:          1,       // round trips

  // ── Labor adjustments (multipliers applied to raw labor cost) ───────────────
  verticalMarket: "commercial",   // commercial | healthcare | k12 | highered
  siteAccess:     true,          // +5% labor
  safetyReqs:     true,          // +2% labor
  occupiedPct:    0,              // % of project in occupied space (+15% to that portion)
  overtimePct:    0,              // % of project at overtime (×1.5)
  shiftPct:       0,              // % of project on shift (×1.15)
  retrofitPct:    0,              // % of project retrofit (+6%)
  supervision:    false,          // nonworking supervision: 10% of labor hrs × rate
  workAbove15Pct: 10,              // % of project work above 15' (+10% labor)
  vavFieldMount:  true,           // +0.5 hrs & $2 mtl per VAV box

  // ── Material adjustments ────────────────────────────────────────────────────
  fireSeals:       true,          // $50 per $1000 of material
  miscMaterials:   true,          // $20 per $1000 of material

  // ── Overhead line items (added to overhead bucket) ──────────────────────────
  truckPerHour:    4.50,          // $ per labor hour (truck/job box)
  parkingDirect:   0,             // flat $ direct cost
  hotelMealsDirect: 0,            // flat $ direct cost
  drugTesting:     false,         // 1% of total hrs (cost of tests)
  permitFee:       false,         // 1.5% of (labor + material)

  // ── Equipment rentals (direct overhead costs) ───────────────────────────────
  scissorLiftPickup:  410,         // drop-off / pickup flat fee
  scissorLiftDaily:   335,           // daily rental rate
  scissorLiftWeekly:  1106,        // weekly rental rate
  scissorLiftMonthly: 2000,           // monthly rental rate
  trencher:       false,
  coreDrilling:   0,              // number of holes
};

export const ESTIMATE_SCOPE_MODES = [
  {
    id: "installation",
    label: "Install Only",
    description: "Bid the installation scope only. This is the physical controls installation price.",
  },
  {
    id: "both",
    label: "Turnkey",
    description: "Bid installation plus controls together as one combined turnkey price, computed automatically from the controls catalog.",
  },
];

export function normalizeEstimateScopeMode(value) {
  const normalized = String(value || "").toLowerCase();
  return ESTIMATE_SCOPE_MODES.some((mode) => mode.id === normalized) ? normalized : "installation";
}

export function getEstimateScopeModeLabel(value) {
  return ESTIMATE_SCOPE_MODES.find((mode) => mode.id === normalizeEstimateScopeMode(value))?.label || "Install Only";
}

// Vertical market labor adjustment factors
export const VERTICAL_MARKETS = [
  { id: "commercial", label: "Commercial",       factor: 0 },
  { id: "healthcare", label: "Healthcare",        factor: 0.15 },
  { id: "k12",        label: "K-12 Education",   factor: -0.10 },
  { id: "highered",   label: "Higher Education",  factor: 0.10 },
];

/**
 * computeCosts(rawMtl, rawLbrHrs, settings, items)
 *
 * Takes raw material cost and raw labor hours from line items,
 * applies all adjustments, and returns the four-bucket breakdown.
 *
 * @param {number} rawMtl      - total material cost before adjustments
 * @param {number} rawLbrHrs   - total labor hours before adjustments
 * @param {object} settings    - project settings (merged with DEFAULT_SETTINGS)
 * @param {Array}  items       - estimate items (used for VAV count, etc.)
 * @returns {object}           - { labor, material, overhead, profit, bond, total, adjustments }
 */
export function computeCosts(rawMtl, rawLbrHrs, settings = {}, items = []) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (rawMtl === 0 && rawLbrHrs === 0 && (!items || items.length === 0)) {
    return {
      labor: 0,
      material: 0,
      overhead: 0,
      profit: 0,
      bond: 0,
      total: 0,
      rawLaborCost: 0,
      rawMtl: 0,
      rawLbrHrs: 0,
      adjustments: {
        labor: {
          verticalMarket: 0,
          siteAccess: 0,
          safety: 0,
          occupied: 0,
          overtime: 0,
          shift: 0,
          retrofit: 0,
          above15: 0,
          supervision: 0,
          vavFieldMount: 0,
        },
        material: {
          vavFieldMount: 0,
          fireSeals: 0,
          miscMaterials: 0,
        },
        overhead: {
          base: 0,
          mileage: 0,
          truck: 0,
          parking: 0,
          hotel: 0,
          drugTest: 0,
          permit: 0,
          scissorLift: 0,
          trencher: 0,
          coring: 0,
        },
      },
    };
  }

  // ── 1. LABOR ────────────────────────────────────────────────────────────────
  const baseLabor = rawLbrHrs * s.wageRate;

  // Vertical market adjustment
  const vmFactor = VERTICAL_MARKETS.find(v => v.id === s.verticalMarket)?.factor ?? 0;
  const vmAdj    = baseLabor * vmFactor;

  // Site access +5%
  const siteAdj  = s.siteAccess ? baseLabor * 0.05 : 0;

  // Safety requirements +2%
  const safetyAdj = s.safetyReqs ? baseLabor * 0.02 : 0;

  // Occupied facility (% of project × 15%)
  const occupiedAdj = baseLabor * (s.occupiedPct / 100) * 0.15;

  // Overtime (% of project at 1.5×, so the extra is 0.5× that portion)
  const overtimeAdj = baseLabor * (s.overtimePct / 100) * 0.5;

  // Shift work (% of project at 1.15×, extra is 0.15×)
  const shiftAdj = baseLabor * (s.shiftPct / 100) * 0.15;

  // Retrofit (% of project +6%)
  const retrofitAdj = baseLabor * (s.retrofitPct / 100) * 0.06;

  // Work above 15' height (+10% labor on affected area)
  const above15Adj = baseLabor * (s.workAbove15Pct / 100) * 0.10;

  // Nonworking supervision: 10% of labor hrs × wage rate
  const supervisionAdj = s.supervision ? rawLbrHrs * 0.10 * s.wageRate : 0;

  // VAV field mount: +0.5 hrs per VAV box
  const vavCount = items.filter(it => it.type === "vav").reduce((a, it) => a + it.qty, 0);
  const vavLbrAdj = s.vavFieldMount ? vavCount * 0.5 * s.wageRate : 0;

  const totalLaborAdj = vmAdj + siteAdj + safetyAdj + occupiedAdj +
    overtimeAdj + shiftAdj + retrofitAdj + above15Adj + supervisionAdj + vavLbrAdj;

  const labor = baseLabor + totalLaborAdj;

  // ── 2. MATERIAL ─────────────────────────────────────────────────────────────
  // VAV field mount material: +$2 per VAV box
  const vavMtlAdj = s.vavFieldMount ? vavCount * 2 : 0;

  const adjustedMtlBase = rawMtl + vavMtlAdj;

  // Fire seals: $50 per $1000 of material
  const fireSealsAdj = s.fireSeals ? adjustedMtlBase * (50 / 1000) : 0;

  // Misc materials: $20 per $1000 of material
  const miscMtlAdj = s.miscMaterials ? adjustedMtlBase * (20 / 1000) : 0;

  const material = adjustedMtlBase + fireSealsAdj + miscMtlAdj;

  // ── 3. OVERHEAD ─────────────────────────────────────────────────────────────
  const laborMtl = labor + material;

  // Base overhead % of (labor + material)
  const baseOverhead = laborMtl * (s.overheadPct / 100);

  // Mileage: miles (round trip) × rate × trips
  const mileageAdj = s.milesOneWay * s.mileageRate * s.trips;

  // Truck/job box: $/hr × total hours
  const truckAdj = rawLbrHrs * s.truckPerHour;

  // Parking
  const parkingAdj = s.parkingDirect || 0;

  // Hotel/meals
  const hotelAdj = s.hotelMealsDirect || 0;

  // Drug testing: 1% of total hrs × 2× (cost of tests)
  const drugAdj = s.drugTesting ? rawLbrHrs * 0.01 * s.wageRate * 2 : 0;

  // Permit fee: 1.5% of (labor + material)
  const permitAdj = s.permitFee ? laborMtl * 0.015 : 0;

  // Scissor lift: lift days = ceil(above-15 hrs / 10hr day), pick cheapest rental tier
  const liftHrs  = rawLbrHrs * (s.workAbove15Pct / 100);
  const liftDays = liftHrs > 0 ? Math.ceil(liftHrs / 10) : 0;
  let scissorAdj = 0;
  if (liftDays > 0 && (s.scissorLiftDaily > 0 || s.scissorLiftWeekly > 0 || s.scissorLiftMonthly > 0)) {
    const pickup = s.scissorLiftPickup || 0;
    const opts = [];
    if (s.scissorLiftDaily   > 0) opts.push(pickup + liftDays                    * s.scissorLiftDaily);
    if (s.scissorLiftWeekly  > 0) opts.push(pickup + Math.ceil(liftDays / 5)     * s.scissorLiftWeekly);
    if (s.scissorLiftMonthly > 0) opts.push(pickup + Math.ceil(liftDays / 21)    * s.scissorLiftMonthly);
    scissorAdj = Math.min(...opts);
  }
  const trencherAdj = s.trencher ? 575 : 0;   // daily + P/U
  const coreAdj     = Math.max(
    (s.coreDrilling || 0) * 50,  // per-hole cost
    (s.coreDrilling || 0) > 0 ? 200 : 0  // minimum charge
  );

  const overhead = baseOverhead + mileageAdj + truckAdj + parkingAdj +
    hotelAdj + drugAdj + permitAdj + scissorAdj + trencherAdj + coreAdj;

  // ── 4. PROFIT ───────────────────────────────────────────────────────────────
  const profit = (labor + material + overhead) * (s.profitPct / 100);

  // ── 5. BOND ─────────────────────────────────────────────────────────────────
  const bond = (labor + material + overhead + profit) * (s.bondPct / 100);

  // ── TOTAL ───────────────────────────────────────────────────────────────────
  const total = labor + material + overhead + profit + bond;

  return {
    // Buckets
    labor,
    material,
    overhead,
    profit,
    bond,
    total,
    // Raw inputs
    rawLaborCost: baseLabor,
    rawMtl,
    rawLbrHrs,
    // Sub-items for display
    adjustments: {
      labor: {
        verticalMarket: vmAdj,
        siteAccess:     siteAdj,
        safety:         safetyAdj,
        occupied:       occupiedAdj,
        overtime:       overtimeAdj,
        shift:          shiftAdj,
        retrofit:       retrofitAdj,
        above15:        above15Adj,
        supervision:    supervisionAdj,
        vavFieldMount:  vavLbrAdj,
      },
      material: {
        vavFieldMount:  vavMtlAdj,
        fireSeals:      fireSealsAdj,
        miscMaterials:  miscMtlAdj,
      },
      overhead: {
        base:       baseOverhead,
        mileage:    mileageAdj,
        truck:      truckAdj,
        parking:    parkingAdj,
        hotel:      hotelAdj,
        drugTest:   drugAdj,
        permit:     permitAdj,
        scissorLift: scissorAdj,
        trencher:   trencherAdj,
        coring:     coreAdj,
      },
    },
  };
}

/**
 * Controls Material + Controls Engineering Labor, with the same
 * overhead/profit/bond markups as computeCosts, allocated proportionally
 * back onto labor and material so they sum cleanly to total.
 */
export function computeControlsCosts(controlsMtl, controlsLbrHrs, settings = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const rawLabor = controlsLbrHrs * s.controlsWageRate;
  const rawMaterial = controlsMtl;
  const rawTotal = rawLabor + rawMaterial;

  if (rawTotal === 0) {
    return {
      labor: 0,
      material: 0,
      overhead: 0,
      profit: 0,
      bond: 0,
      total: 0,
      rawLbrHrs: controlsLbrHrs,
      rawMtl: controlsMtl,
    };
  }

  const overhead = rawTotal * (s.overheadPct / 100);
  const profit = (rawTotal + overhead) * (s.profitPct / 100);
  const bond = (rawTotal + overhead + profit) * (s.bondPct / 100);
  const total = rawTotal + overhead + profit + bond;
  const markupFactor = total / rawTotal;

  return {
    labor: rawLabor * markupFactor,
    material: rawMaterial * markupFactor,
    overhead,
    profit,
    bond,
    total,
    rawLbrHrs: controlsLbrHrs,
    rawMtl: controlsMtl,
  };
}

/**
 * Soft 40/40/20 check: Installation total, Installation labor,
 * Controls material, and Controls engineering labor as a % of the
 * combined Turnkey Total.
 * Returns null when there's nothing to check yet.
 */
export function getSanityCheck({
  installTotal = 0,
  installLabor = 0,
  controlsMaterial = 0,
  controlsLabor = 0,
}) {
  const turnkeyTotal = installTotal + installLabor + controlsMaterial + controlsLabor;
  if (turnkeyTotal <= 0) return null;

  return {
    turnkeyTotal,
    install: { value: installTotal, pct: (installTotal / turnkeyTotal) * 100, target: 40 },
    installLabor: { value: installLabor, pct: (installLabor / turnkeyTotal) * 100, target: 40 },
    controlsMaterial: { value: controlsMaterial, pct: (controlsMaterial / turnkeyTotal) * 100, target: 40 },
    controlsLabor: { value: controlsLabor, pct: (controlsLabor / turnkeyTotal) * 100, target: 20 },
  };
}
