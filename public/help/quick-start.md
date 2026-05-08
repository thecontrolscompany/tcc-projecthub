# Quick Start

Get up and running with the HVAC Controls Estimator in a few minutes.

## What This App Does

The HVAC Controls Estimator builds detailed cost estimates for BAS/controls projects. You configure equipment systems, the app auto-selects the right components based on your configuration, and you export a priced proposal or internal cost breakdown.

Supported system types: AHU, VAV, FCU, RTU, DX/Heat Pump, VRF, Unit Heater, Central Plant, and Network.

## First-Day Workflow

1. **Create an estimate** — go to the Estimates tab and click **New Estimate**. Give it a name, number, and job site.
2. **Set project settings** — open the estimate, then click **Settings** to configure markups, wage rate, and labor adjustments before adding items.
3. **Add equipment** — use the **System Wizard** to pick a system type and walk through the configuration options. The wizard pre-selects the right components automatically.
4. **Review line items** — open each item in the editor to adjust component selections, quantities, and add custom labor or material as needed.
5. **Export** — use **Generate Proposal** for the customer-facing `.html`, or **Internal Report** for the full cost breakdown.

---

## Creating an Estimate

1. Go to the **Estimates** tab.
2. Click **New Estimate**.
3. Enter the project name and number.
4. The estimate opens automatically — you're ready to add equipment.

---

## Adding Equipment with the System Wizard

The System Wizard walks you through system type selection and configuration before opening the editor.

1. Click **System Wizard** in the top navigation.
2. Select a system type (AHU, VAV, FCU, etc.).
3. Work through the configuration steps — coil types, fan types, heat source, etc.
4. Click **Add to Estimate**. The editor opens with the correct components already selected.

You can also add items directly from the estimate by clicking **Add Item** and choosing a system type.

---

## Editing a Line Item

Each line item opens a system-specific editor showing:

- **Components** — checkboxes for each piece of hardware. Items auto-selected by your configuration are pre-checked; you can add or remove anything.
- **Quantities** — adjust how many of each component applies.
- **Assemblies** — click **Add Assembly** to pull from the full 445-assembly catalog, or enter a custom material cost or labor hours directly.
- **Points List** — review the I/O points for the system.

---

## Saving Your Work

All data is saved automatically to your browser's local storage after every change. There is no manual save button and no cloud sync — do not clear your browser storage unless you intend to wipe all estimate data.

---

## Common First-Day Questions

**Where are the prices coming from?**
Assembly prices come from the built-in price book, which is based on the EBT (Electrical Budgeting Tool) assembly catalog. See [Assembly Pricing Model](reference/assembly-pricing.md) for how material and labor are calculated.

**Can I change the markup or profit margin?**
Yes. Open your estimate and go to **Settings**. You can set markups, wage rate, overhead items, equipment rentals, and bond separately.

**The wizard pre-selected some components. Can I change them?**
Yes. Open the line item editor and check or uncheck components freely. The wizard sets intelligent defaults based on your configuration — you always have full control.

**How do I add a component that's not in the standard list?**
In any editor, use the **Add Assembly** button. You can search the full 445-assembly catalog, or use the quick-add section to enter a custom material dollar amount or labor hours directly.

**What's the difference between EMT and Plenum pricing?**
EMT pricing uses conduit-and-wire assemblies. Plenum pricing uses plenum-rated cable runs. The install type is set per line item and affects which assembly variant is priced. You can set a default install type in the estimate settings and bulk-apply it to all existing items.
