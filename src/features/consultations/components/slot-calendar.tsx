import { useMemo } from "react";

import type { B2cSlot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/kit";
import { utcDayKey } from "../lib";

type Props = {
  /** First of the shown month, as a UTC date. */
  month: Date;
  onMonthChange: (month: Date) => void;
  slots: B2cSlot[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
};

/** Month grid of an expert's slots; days show free / held / booked counts (all UTC). */
export function SlotCalendar({ month, onMonthChange, slots, selectedDay, onSelectDay }: Props) {
  const t = useT();
  const counts = useMemo(() => {
    const map = new Map<string, { free: number; held: number; booked: number }>();
    for (const slot of slots) {
      const key = utcDayKey(slot.starts_at);
      const entry = map.get(key) ?? { free: 0, held: 0, booked: 0 };
      entry[slot.state] += 1;
      map.set(key, entry);
    }
    return map;
  }, [slots]);

  const year = month.getUTCFullYear();
  const mon = month.getUTCMonth();
  const lead = month.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, mon, i + 1)).toISOString().slice(0, 10)),
  ];
  const dow = [t("أحد", "Sun"), t("اثنين", "Mon"), t("ثلاثاء", "Tue"), t("أربعاء", "Wed"), t("خميس", "Thu"), t("جمعة", "Fri"), t("سبت", "Sat")];
  const title = new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "long", year: "numeric" }).format(month);

  return (
    <div className="ma-cal">
      <div className="ma-cal__bar">
        <Button kind="ghost" sm icon="chevronStart" iconDir aria-label={t("الشهر السابق", "Previous month")}
          onClick={() => onMonthChange(new Date(Date.UTC(year, mon - 1, 1)))} />
        <h3 className="ma-cal__title">{title} · UTC</h3>
        <Button kind="ghost" sm icon="chevronEnd" iconDir aria-label={t("الشهر التالي", "Next month")}
          onClick={() => onMonthChange(new Date(Date.UTC(year, mon + 1, 1)))} />
      </div>
      <div className="ma-cal__grid" role="grid">
        {dow.map((d) => (
          <div key={d} className="ma-cal__dow" role="columnheader">{d}</div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`e${index}`} className="ma-cal__day ma-cal__day--out" />;
          const c = counts.get(day);
          return (
            <button key={day} type="button" className="ma-cal__day" aria-pressed={selectedDay === day}
              onClick={() => onSelectDay(day)}>
              <span className="ma-cal__num">{Number(day.slice(8))}</span>
              {c ? (
                <span className="ma-cal__counts">
                  {c.free ? <span className="ma-cal__dot ma-cal__dot--free">{c.free}</span> : null}
                  {c.held ? <span className="ma-cal__dot ma-cal__dot--held">{c.held}</span> : null}
                  {c.booked ? <span className="ma-cal__dot ma-cal__dot--booked">{c.booked}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
