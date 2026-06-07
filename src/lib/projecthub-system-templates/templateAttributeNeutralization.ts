/**
 * Imported template markup carries vendor/source attribute names (e.g. `jci-id`,
 * `jci-width`) inherited from the original authoring tool. Runtime code must not
 * depend on those names — selectors built against them are also source-naming
 * leaks and, worse, are not guaranteed to be unique per instance (see the
 * RA-SD / DA-SD smoke detector collision documented in
 * tools/template-import/output/mixed_air_instance_mapping_audit.md, where two
 * glyph instances shared `jci-id="smoke_detector"`).
 *
 * This module mirrors each known vendor attribute onto a neutral
 * `data-template-*` equivalent so future selectors and debug tooling can query
 * neutral names. The original attributes are left in place — stripping them is
 * unnecessary risk (the source markup may rely on them for its own styling/JS
 * that ships with the bundle) — but nothing in ProjectHub runtime code should
 * read them going forward.
 */

const NEUTRAL_ATTRIBUTE_MAP: Record<string, string> = {
  'jci-id': 'data-template-component-id',
  'jci-width': 'data-template-source-width',
  'jci-height': 'data-template-source-height',
  'jci-align': 'data-template-align',
  'jci-joints': 'data-template-joints',
};

const VENDOR_ATTR_REGEX = new RegExp(
  `\\s(${Object.keys(NEUTRAL_ATTRIBUTE_MAP).map((name) => name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})=(['"])([^'"]*)\\2`,
  'gi'
);

/**
 * Mirrors recognized `jci-*` attributes onto neutral `data-template-*`
 * equivalents in raw markup, without removing the originals. Run before the
 * markup is handed to the client so DOM queries can target neutral attributes
 * exclusively.
 */
export function neutralizeTemplateMarkupAttributes(markup: string) {
  if (!markup) return markup;

  return markup.replace(VENDOR_ATTR_REGEX, (full, name: string, quote: string, value: string) => {
    const neutralName = NEUTRAL_ATTRIBUTE_MAP[name.toLowerCase()];
    if (!neutralName) return full;
    return `${full} ${neutralName}=${quote}${value}${quote}`;
  });
}

export function getNeutralTemplateAttributeName(vendorAttributeName: string) {
  return NEUTRAL_ATTRIBUTE_MAP[vendorAttributeName.toLowerCase()] ?? null;
}

export const TEMPLATE_NEUTRAL_ATTRIBUTE_NAMES = Object.values(NEUTRAL_ATTRIBUTE_MAP);
