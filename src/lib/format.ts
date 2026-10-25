/**
 * Money is integer minor units in B2C; legacy rows carry plain floats. One helper per shape.
 */

export function formatMinor(amountMinor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatAmount(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

/** Axis ticks: 1.2K, 45K, 3.4M — Latin digits in both languages. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** `2026-10-01` (or an ISO datetime) → `10/01/2026`; day-only → `01`. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit" }).format(date);
}

export function formatShortDay(iso: string | null | undefined): string {
  return iso ? iso.slice(8, 10) : "";
}

/** `2026-10-01` style input value → `10/01/2026 - 10/31/2026` range label. */
export function formatRangeLabel(start: string, end: string): string {
  const toSlash = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${month}/${day}/${year}`;
  };
  return `${toSlash(start)} - ${toSlash(end)}`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: undefined }).format(new Date(iso));
}

/** `2026-09` (or an ISO date) → `Sep 2026`. */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const normalized = iso.length === 7 ? `${iso}-01` : iso;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(`${normalized.slice(0, 10)}T00:00:00`));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Formats seconds into digital clock time `mm:ss` or `hh:mm:ss` (e.g. 63 → "1:03", 324 → "5:24"). */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/** Formats duration into human string, e.g. "32 دقيقة" or "2 ساعة و 15 دقيقة" (or "32 mins"). */
export function formatHumanDuration(seconds: number | null | undefined, isAr = true): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return "";
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) {
    if (isAr) {
      return mins > 0 ? `${hrs} ساعة و ${mins} دقيقة` : `${hrs} ساعة`;
    }
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  const effectiveMins = mins > 0 ? mins : s > 0 ? 1 : 0;
  return isAr ? `${effectiveMins} دقيقة` : `${effectiveMins} min${effectiveMins !== 1 ? "s" : ""}`;
}

