/** Port of Apps Script CONFIG (Config.js). */
export const SCHEDULE = {
  ROWS_PER_WEEK: 16,
  HEADER_ROWS: 3,
  DATA_ROWS: 12,
  COLS_PER_DAY: 6,
  WEEKS_DEFAULT: 5,
  DAYS_PER_WEEK: 7
} as const;

export const GOAL = {
  SCORE_DAYS: 7 // Mon–Sun
} as const;

export const TRACKER_WINNER_COLORS = {
  PD: "#cfe2f3",
  NA: "#d9d9d9",
  GANG: "#f4cccc",
  DEFAULT: "#ffffff"
} as const;

export const STATS_HEADER = {
  BG: "#0b5394",
  FG: "#ffffff"
} as const;

export const STAFF_RANK_ORDER = ["MOO:", "ADM:", "AUX:", "LD:", "S.LD", "Member"] as const;
