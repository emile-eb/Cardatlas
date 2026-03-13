export function formatDate(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
