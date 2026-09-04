const DEFAULT_EXPORT_SEGMENT = "chart";


export function sanitizePlotExportSegment(
  value,
  fallback = DEFAULT_EXPORT_SEGMENT
) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}


export function buildPlotExportConfig({
  scope,
  label,
} = {}) {
  const safeScope =
    sanitizePlotExportSegment(
      scope,
      DEFAULT_EXPORT_SEGMENT
    );
  const safeLabel =
    sanitizePlotExportSegment(
      label,
      DEFAULT_EXPORT_SEGMENT
    );

  return {
    responsive: true,
    displaylogo: false,
    toImageButtonOptions: {
      format: "png",
      filename:
        `performance-system-${safeScope}-${safeLabel}`,
      scale: 2,
    },
  };
}
