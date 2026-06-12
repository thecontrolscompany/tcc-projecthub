function toNumber(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

export function mapCatalogRows(rows = []) {
  return Object.fromEntries(
    rows
      .filter((row) => row && typeof row.id === "string" && row.id.trim())
      .map((row) => {
        const id = row.id.trim();
        const partNumber = typeof row.part_number === "string" && row.part_number.trim() ? row.part_number.trim() : null;
        const manufacturer = typeof row.manufacturer === "string" && row.manufacturer.trim() ? row.manufacturer.trim() : null;
        const ioType = typeof row.io_type === "string" && row.io_type.trim() ? row.io_type.trim() : null;
        return [
          id,
          {
            id,
            desc: toString(row.description, ""),
            mtlUnit: toNumber(row.mtl_unit, 0),
            mtlPer: toString(row.mtl_per, "E"),
            hrsUnit: toNumber(row.hrs_unit, 0),
            hrsPer: toString(row.hrs_per, "E"),
            category: typeof row.category === "string" && row.category.trim() ? row.category : null,
            freq: Boolean(row.freq),
            alternateIds: toArray(row.alternate_ids),
            partNumber,
            manufacturer,
            ioType,
          },
        ];
      }),
  );
}
