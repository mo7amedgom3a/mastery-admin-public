import type { B2cSlot } from "@/lib/api";

/** The backend stores naive UTC; the dashboard shows it as UTC so everyone reads the same clock. */
const utcFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const utcTime = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
const utcDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" });

/** Left-to-right isolate: keeps times and ranges readable inside Arabic (RTL) text. */
const ltr = (text: string): string => `\u2066${text}\u2069`;

export const formatUtc = (iso: string | null | undefined): string => (iso ? ltr(`${utcFmt.format(new Date(iso))} UTC`) : "—");
export const formatUtcTime = (iso: string): string => utcTime.format(new Date(iso));
export const formatUtcDay = (iso: string): string => utcDay.format(new Date(iso));
export const utcDayKey = (iso: string): string => iso.slice(0, 10);
export const slotRange = (slot: { starts_at: string; ends_at: string }): string =>
  ltr(`${formatUtcTime(slot.starts_at)}–${formatUtcTime(slot.ends_at)}`);

export const startOfUtcMonth = (year: number, month: number): Date => new Date(Date.UTC(year, month, 1));

/** Runs of `need` back-to-back slots, each run keyed by its first slot. */
export function consecutiveRuns<T extends Pick<B2cSlot, "slot_id" | "starts_at" | "ends_at">>(
  slots: T[],
  need: number,
): T[][] {
  const sorted = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const runs: T[][] = [];
  for (let i = 0; i + need <= sorted.length; i += 1) {
    const run = sorted.slice(i, i + need);
    if (run.every((slot, index) => index === 0 || run[index - 1].ends_at === slot.starts_at)) runs.push(run);
  }
  return runs;
}

/** `days` x `perDay` back-to-back UTC slots of `minutes`, starting at `startTime` (HH:MM) each day. */
export function buildSlotWindows(opts: {
  fromDate: string;
  toDate: string;
  startTime: string;
  perDay: number;
  minutes: number;
}): { starts_at: string; ends_at: string }[] {
  const out: { starts_at: string; ends_at: string }[] = [];
  const first = new Date(`${opts.fromDate}T00:00:00Z`);
  const last = new Date(`${opts.toDate || opts.fromDate}T00:00:00Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || !/^\d{2}:\d{2}$/.test(opts.startTime)) return out;
  for (let day = first; day <= last; day = new Date(day.getTime() + 86_400_000)) {
    const start0 = new Date(`${day.toISOString().slice(0, 10)}T${opts.startTime}:00Z`);
    for (let i = 0; i < opts.perDay; i += 1) {
      const s = new Date(start0.getTime() + i * opts.minutes * 60_000);
      const e = new Date(s.getTime() + opts.minutes * 60_000);
      out.push({ starts_at: s.toISOString(), ends_at: e.toISOString() });
    }
  }
  return out;
}
