/** Mobility / bathroom safety category attribute fields to check in audits. */
export const MOBILITY_ATTRIBUTE_FIELDS = [
  "Material",
  "Color",
  "Item Weight",
  "Weight Capacity",
  "Product Dimensions",
  "Target Audience",
  "Special Feature",
  "Recommended Uses",
  "Installation Type",
  "Maximum Weight Recommendation",
  "Frame Material",
  "Seat Material",
  "Handle Type",
  "Number of Items",
] as const;

export const MOBILITY_SEARCH_TERM_EXAMPLES = [
  "shower chair",
  "bath transfer bench",
  "bathtub seat",
  "bathroom safety",
  "elderly bathroom assist",
  "mobility aid",
  "non-slip bath seat",
  "post-surgery bath assist",
];

export const MOBILITY_CATEGORY_HINTS = [
  "Bathroom Safety",
  "Mobility Aids & Equipment",
  "Medical Supplies & Equipment",
  "Shower & Bath Stools",
];

export function formatMobilityChecklistForPrompt(): string {
  return [
    "Required / high-value attributes for mobility & bathroom safety:",
    MOBILITY_ATTRIBUTE_FIELDS.join(", "),
    "",
    "Example backend search synonyms (do not copy blindly — adapt to product):",
    MOBILITY_SEARCH_TERM_EXAMPLES.join(", "),
    "",
    "Typical browse categories:",
    MOBILITY_CATEGORY_HINTS.join(" · "),
  ].join("\n");
}
