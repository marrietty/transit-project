// types.ts
// Single source of truth for all shared domain types in CommuteWatch.

// ─── Congestion ───────────────────────────────────────────────────────────────

/** Numeric congestion level: 1 = Clear, 2 = Moderate, 3 = Heavy */
export type CongestionLevel = 1 | 2 | 3;

export interface CongestionConfig {
  level: CongestionLevel;
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  glowClass: string;
  badgeBg: string;
  hex: string;
  ariaLabel: string;
}

// ─── Time windows ─────────────────────────────────────────────────────────────

export type TimeWindowKey = "morning_peak" | "off_peak" | "evening_peak";

export interface TimeOfDayResult {
  timeWindow: TimeWindowKey;
  currentTime: Date;
  label: string;
}

// ─── Station data ─────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface HistoricalBaseline {
  morning_peak: CongestionLevel;
  off_peak: CongestionLevel;
  evening_peak: CongestionLevel;
}

export interface Station {
  id: string;
  name: string;
  short_code: string;
  line: LineId;
  order: number;
  is_terminal: boolean;
  coordinates: Coordinates;
  interchanges: string[];
  historical_baseline: HistoricalBaseline;
}

// ─── Rail lines ───────────────────────────────────────────────────────────────

export type LineId = "mrt3" | "lrt1" | "lrt2";

export interface RailLine {
  id: LineId;
  name: string;
  full_name: string;
  color: string;
  text_color: string;
  direction_label: string;
  stations: Station[];
}

export interface StationsData {
  lines: RailLine[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface StationReport {
  level: CongestionLevel;
  timestamp: number;
}

/** Map of stationId → list of reports */
export type ReportsStore = Record<string, StationReport[]>;

export interface UseReportsResult {
  submitReport: (stationId: string, level: CongestionLevel) => void;
  getReportedLevel: (stationId: string) => CongestionLevel | null;
  getReportCount: (stationId: string) => number;
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface StationRowProps {
  station: Station;
  lineId: LineId;
  isFirst: boolean;
  isLast: boolean;
  reportedLevel: CongestionLevel | null;
  reportCount: number;
  onReport: (station: Station) => void;
}

export interface ReportModalProps {
  station: Station;
  onSubmit: (stationId: string, level: CongestionLevel) => void;
  onClose: () => void;
}

export interface RailLineViewProps {
  line: RailLine;
}

export interface LineTabsProps {
  lines: RailLine[];
  activeLineId: LineId;
  onSelect: (id: LineId) => void;
}