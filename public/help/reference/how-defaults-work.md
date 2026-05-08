# How Defaults Work

## Overview

When you add a new line item using the System Wizard, components are automatically selected based on your configuration choices. This is driven by `defaultWhen` rules defined for each component.

## defaultWhen Rules

Each component in a system can have a `defaultWhen(cfg)` rule — a function that takes the system configuration and returns `true` if that component should be selected by default.

Examples:

- A hot water supply temperature sensor defaults on when the AHU has a hot water coil configured.
- A reheat valve actuator defaults on when the VAV is configured with hot water reheat.
- An FCU discharge air temperature sensor defaults on for all FCU configurations.

## showWhen Rules

Separate from defaults, `showWhen(cfg)` controls whether a component is even visible in the editor. If `showWhen` returns false, the component is hidden entirely — it cannot be selected.

This prevents irrelevant components from cluttering the editor. For example, a reheat valve will not appear in the editor at all if the VAV configuration has no heat.

## Exclusive Groups

Some components belong to exclusive groups — exactly one member can be selected at a time. The most common example is the reheat actuator type (proportional, two-position, or incremental). Selecting one automatically deselects the others.

## When Defaults Run

- **New items**: When a line item is created via the wizard, defaults are applied immediately based on the wizard configuration.
- **Configuration changes**: If you change a configuration field (e.g., switch from hot water to electric reheat), the editor reconciles selections automatically — removing components that no longer apply and selecting new defaults.
- **Existing items**: When you open an existing item, the stored selections are used as-is. Defaults do not re-run on load.

## Manual Overrides

You always have full control. Any component can be checked or unchecked manually regardless of what the default rules say. Defaults are a starting point, not a constraint.

---

*For the technical implementation, see `vavData.js`, `ahuData.js`, and other system data files in the source.*
