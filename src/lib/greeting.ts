import { useEffect, useState } from "react";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type GreetingDef = {
  ar: string;
  en: string;
  timeOfDay: TimeOfDay;
};

export const TIME_GREETINGS: Record<TimeOfDay, { ar: string; en: string }> = {
  morning: { ar: "صباح الخير", en: "Good morning" },
  afternoon: { ar: "طاب يومك", en: "Good afternoon" },
  evening: { ar: "مساء الخير", en: "Good evening" },
  night: { ar: "طابت ليلتك", en: "Good night" },
};

/**
 * Categorizes the given time into a time-of-day segment:
 * - Morning:   05:00 - 11:59 (5 <= hour < 12)
 * - Afternoon: 12:00 - 16:59 (12 <= hour < 17)
 * - Evening:   17:00 - 21:59 (17 <= hour < 22)
 * - Night:     22:00 - 04:59 (hour >= 22 || hour < 5)
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Returns localized greeting strings (Arabic + English) based on the time of day.
 */
export function getGreeting(date: Date = new Date()): GreetingDef {
  const timeOfDay = getTimeOfDay(date);
  const text = TIME_GREETINGS[timeOfDay];
  return { ...text, timeOfDay };
}

/**
 * Reactive hook that updates the greeting if the day transitions while the tab remains open.
 */
export function useTimeGreeting(): GreetingDef {
  const [greeting, setGreeting] = useState<GreetingDef>(() => getGreeting());

  useEffect(() => {
    const check = () => {
      const next = getGreeting();
      setGreeting((prev) => (prev.timeOfDay !== next.timeOfDay ? next : prev));
    };

    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  return greeting;
}
