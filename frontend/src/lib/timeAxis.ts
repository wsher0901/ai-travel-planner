export const DAY_MINUTES = 1440;

export function timeToMinutes(t: string | Date): number {
  if (t instanceof Date) {
    return t.getHours() * 60 + t.getMinutes();
  }
  if (!t) return 0;

  const ampm = t.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  if (t.includes(':')) {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  return 0;
}

export function timeToPercent(t: string | Date): number {
  return (timeToMinutes(t) / DAY_MINUTES) * 100;
}
