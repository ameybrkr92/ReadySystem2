export const fmtINR = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

export const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

export const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

export const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const todayISO = () => new Date().toISOString();

export const toISODate = (yyyy_mm_dd: string) => {
  if (!yyyy_mm_dd) return undefined;
  return new Date(yyyy_mm_dd).toISOString();
};

export const isoToInputDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
};
