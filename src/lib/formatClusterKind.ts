/** Acronym-aware snake_case → Title Case for cluster_kind values */
const ACRONYMS = new Set([
  "HDL", "LDL", "VLDL", "IDL",
  "TMAO", "SHBG", "DHEA", "FSH", "LH",
  "TSH", "T3", "T4", "PTH",
  "CRP", "ESR", "WBC", "RBC", "MCH", "MCV", "MCHC", "RDW",
  "ALT", "AST", "GGT", "ALP", "BUN", "GFR", "EGFR",
  "HBA1C", "HOMA", "HOMA-IR",
  "APOB", "APOA1", "APOA",
  "EPA", "DHA", "DPA",
  "VCAM1", "CCL2", "MCP1",
  "CGM", "HRV", "BMI", "VO2",
  "PCSK9", "LDLR", "APOE",
  "CIE", "CAC", "CIMT", "DEXA",
  "BCS", "OFFI", "FPIS", "BRI", "TIS", "CLI", "HPI", "GRIP", "SCAR",
]);

export const formatClusterKind = (kind: string): string =>
  kind
    .split("_")
    .map((w) => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
