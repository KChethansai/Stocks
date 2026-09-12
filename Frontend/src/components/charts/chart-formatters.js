// LOCAL GLUE (not Bklit source): Bklit's unpublished ./chart-formatters.
// Call-site-derived API: shortDateFmt.format(date),
// weekdayDateFmt.format(date), intFmt(number).
export const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const _int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function intFmt(value) {
  return typeof value === "number" ? _int.format(value) : value;
}
