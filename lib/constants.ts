/**
 * Centralized list for attribute display order.
 * New attributes not in this list will automatically appear at the end.
 */
export const MASTER_ATTRIBUTE_ORDER = [
  "Flooring", 
  "Frame Type", 
  "Exterior Color", 
  "Exterior Finish", 
  "Exterior Door", 
  "Windows", 
  "Interior Finish", 
  "Interior Door", 
  "Roof Design", 
  "Ceiling Type", 
  "Ceiling Height", 
  "Restroom", 
  "Restroom Water Closet", 
  "Restroom Lavatory", 
  "Restroom Shower", 
  "Electrical Electric Board", 
  "Electrical Load Center", 
  "Electrical Lighting", 
  "Emergency Exit Lighting", 
  "Wiring", 
  "Accessories", 
  "Hvac",
  "State Seal",
  "Roof Load",
  "Floor Load",
  "Wind Speed",
  "State Code",
  "Third Party Affiliate",
  "Occupancy Type"
];

/**
 * Normalizes an attribute name for comparison (removes underscores, lowercase)
 */
export function normalizeAttributeName(name: string): string {
  return name.toLowerCase().replace(/[_\s]+/g, "");
}

const NORMALIZED_ORDER_MAP = new Map(
  MASTER_ATTRIBUTE_ORDER.map((name, index) => [normalizeAttributeName(name), index])
);

/**
 * A reverse map for getting the standard "Pretty Name" from a smashed name.
 * e.g., "exteriorcolor" -> "Exterior Color"
 */
export const PRETTY_NAME_MAP = new Map(
  MASTER_ATTRIBUTE_ORDER.map((name) => [normalizeAttributeName(name), name])
);

/**
 * Returns the sort priority index for a given attribute name.
 * Priority 999 is returned for unknown attributes to keep them at the bottom.
 */
export function getAttributeOrder(name: string | null | undefined): number {
  if (!name) return 999;
  const normalized = normalizeAttributeName(name);
  const index = NORMALIZED_ORDER_MAP.get(normalized);
  return index === undefined ? 999 : index;
}
