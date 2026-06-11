// useTimeOfDay.ts
// Returns the current PHT time window and label.
// Re-evaluates every 60 s so the UI auto-updates at peak/off-peak boundaries.

import { useState, useEffect } from "react";
import type { TimeWindowKey, TimeOfDayResult } from "../types";

export const TIME_WINDOWS = {
  MORNING_PEAK: "morning_peak" as const,
  OFF_PEAK: "off_peak" as const,
  EVENING_PEAK: "evening_peak" as const,
} satisfies Record<string, TimeWindowKey>;

export const TIME_WINDOW_LABELS: Record<TimeWindowKey, string> = {
  morning_peak: "Morning Peak · 6–9 AM",
  off_peak: "Off-Peak · 9 AM–5 PM",
  evening_peak: "Evening Peak · 5–9 PM",
};

/**
 * Converts a Date to Philippine Standard Time (UTC+8) and returns
 * the matching time window key.
 */
function getTimeWindow(date: Date = new Date()): TimeWindowKey {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const pht = new Date(utcMs + 8 * 3_600_000);
  const totalMinutes = pht.getHours() * 60 + pht.getMinutes();

  // Morning peak: 06:00–09:00 → 360–539 min
  if (totalMinutes >= 360 && totalMinutes < 540) {
    return TIME_WINDOWS.MORNING_PEAK;
  }
  // Evening peak: 17:00–21:00 → 1020–1259 min
  if (totalMinutes >= 1020 && totalMinutes < 1260) {
    return TIME_WINDOWS.EVENING_PEAK;
  }
  return TIME_WINDOWS.OFF_PEAK;
}

function toPHT(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 8 * 3_600_000);
}

export function useTimeOfDay(): TimeOfDayResult {
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>(() =>
    getTimeWindow()
  );
  const [currentTime, setCurrentTime] = useState<Date>(() => toPHT(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimeWindow(getTimeWindow(now));
      setCurrentTime(toPHT(now));
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return {
    timeWindow,
    currentTime,
    label: TIME_WINDOW_LABELS[timeWindow],
  };
}
