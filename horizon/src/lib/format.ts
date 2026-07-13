// Money & number formatting — calm, tabular, UK.
export const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export function fmtK(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return s + '£' + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm';
  if (a >= 1e3) return s + '£' + Math.round(a / 1e3) + 'k';
  return s + '£' + Math.round(a);
}
export const fmt = (v: number) => GBP.format(Math.round(v));
export const pct = (v: number, dp = 0) => (v * 100).toFixed(dp) + '%';
export const deflate = (v: number, year: number, startYear: number, inflation: number) =>
  v / Math.pow(1 + inflation, year - startYear);
