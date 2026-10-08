const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const weekdayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  timeZone: "UTC",
});

const dayOfMonthFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** Labels a yyyy-MM-dd date in the browser's locale, as "Mon 12 Oct" in English. */
export function formatDay(isoDate: string): string {
  return dayFormat.format(utcDate(isoDate));
}

/** The short weekday of a yyyy-MM-dd date, as "Mon". */
export function formatWeekday(isoDate: string): string {
  return weekdayFormat.format(utcDate(isoDate));
}

/** The day and month of a yyyy-MM-dd date, as "12 Oct". */
export function formatDayOfMonth(isoDate: string): string {
  return dayOfMonthFormat.format(utcDate(isoDate));
}

/** Labels the local calendar day of an ISO timestamp, as "Mon 12 Oct". */
export function formatTimestampDay(timestamp: string): string {
  return formatDay(localIsoDate(new Date(timestamp)));
}

/** The local time of day of an ISO timestamp. */
export function formatTime(timestamp: string): string {
  return timeFormat.format(new Date(timestamp));
}

/** The local calendar date of a moment as yyyy-MM-dd. */
export function localIsoDate(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${moment.getFullYear()}-${month}-${day}`;
}

/** The current moment as an ISO timestamp, for operations that stamp a time. */
export function nowIso(): string {
  return new Date().toISOString();
}
