// ...existing code...

/**
 * Parse time from a slug string like:
 * "ethereum-up-or-down-august-21-2am-et"
 * Returns: { month: string, day: number, hour: number, ampm: string } | null
 */
export function parseSlugTime(slug: string): { month: string, day: number, hour: number, ampm: string } | null {
  // Example match: "august-21-2am-et"
  const match = slug.match(/([a-z]+)-(\d+)-(\d+)(am|pm)-et/i);
  if (!match) return null;
  return {
    month: match[1][0].toUpperCase() + match[1].slice(1), // Capitalize
    day: parseInt(match[2], 10),
    hour: parseInt(match[3], 10),
    ampm: match[4].toUpperCase(),
  };
}

/**
 * Get current Eastern Time parts
 */
export function getCurrentETParts(): { year: number, month: string, day: number, hour: number, ampm: string } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZone: "America/New_York"
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  const year = parseInt(parts.find(p => p.type === "year")?.value || "0", 10);
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parseInt(parts.find(p => p.type === "day")?.value || "0", 10);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const ampm = (parts.find(p => p.type === "dayPeriod")?.value || "AM").toUpperCase();
  return { year, month, day, hour, ampm };
}

/**
 * Get formatted local time
 */
export function getFormattedLocalTime(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZone: "America/New_York",
    timeZoneName: "short"
  };
  return new Intl.DateTimeFormat("en-US", options).format(now);
}
/**
 * Check if parsed time from a string matches current ET time.
 * Accepts a parser function as parameter.
 */
export function isTimeMatch(
  str: string,
  parser: (input: string) => { month: string, day: number, hour: number, ampm: string } | null
): boolean {
  const timeParts = parser(str);
  if (!timeParts) return false;

  const etParts = getCurrentETParts();
  return (
    timeParts.month.toLowerCase() === etParts.month.toLowerCase() &&
    timeParts.day === etParts.day &&
    timeParts.hour === etParts.hour &&
    timeParts.ampm === etParts.ampm
  );
}

/**
 * Extract coin symbol from event slug
 */
export function extractCoinFromEvent(eventSlug: string): string | undefined {
  if (typeof eventSlug !== 'string') return undefined;
  return eventSlug.split('-')[0];
}
//2025-08-23T00:00:00Z

export function parseEndDateIso(timestamp: string): { year: number, month: number, day: number } | null {
  const date = timestamp.split("T")[0].split("-")
  if (date.length !== 3) return null;
  return { year:Number(date[0]), month:Number(date[1]), day:Number(date[2]) };
}
  

export function matchDateToday(timestamp: string): boolean {
  const date = parseEndDateIso(timestamp);
  if (!date) return false;

  const today = new Date();
  return (
    date.year === today.getFullYear() &&
    date.month === today.getMonth() + 1 &&
    date.day === today.getDate()
  );
}

/**
 * Parse time from a question like:
 * "Will the price of Ethereum be between $4100 and $4200 on August 21 at 4PM ET?"
 * Returns: { month: string, day: number, hour: number, ampm: string } | null
 */
export function parseQuestionTime(question: string): { month: string, day: number, hour: number, ampm: string } | null {
  // Example match: "on August 21 at 4PM ET"
  const match = question.match(/on ([A-Za-z]+) (\d+)\s+at\s+(\d+)(AM|PM) ET/i);
  if (!match) return null;
  return {
    month: match[1],
    day: parseInt(match[2], 10),
    hour: parseInt(match[3], 10),
    ampm: match[4].toUpperCase(),
  };
}