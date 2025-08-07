/**
 * Parse time from a title string
 * Example: "Solana Up or Down - August 5, 6PM ET"
 */
export function parseTitleTime(title: string): { month: string, day: number, hour: number, ampm: string } | null {
  const match = title.match(/([A-Za-z]+) (\d+), (\d+)(AM|PM) ET/i);
  if (!match) return null;
  return {
    month: match[1],
    day: parseInt(match[2], 10),
    hour: parseInt(match[3], 10),
    ampm: match[4].toUpperCase(),
  };
}

/**
 * Get current Eastern Time parts
 */
export function getCurrentETParts(): { month: string, day: number, hour: number, ampm: string } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZone: "America/New_York"
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parseInt(parts.find(p => p.type === "day")?.value || "0", 10);
  let hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const ampm = (parts.find(p => p.type === "dayPeriod")?.value || "AM").toUpperCase();
  return { month, day, hour, ampm };
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
 * Check if title time matches current ET time
 */
export function isTimeMatch(title: string): boolean {
  const titleParts = parseTitleTime(title);
  if (!titleParts) return false;

  const etParts = getCurrentETParts();
  
  return (
    titleParts.month.toLowerCase() === etParts.month.toLowerCase() &&
    titleParts.day === etParts.day &&
    titleParts.hour === etParts.hour &&
    titleParts.ampm === etParts.ampm
  );
}

/**
 * Extract coin symbol from event slug
 */
export function extractCoinFromEvent(eventSlug: string): string | undefined {
  if (typeof eventSlug !== 'string') return undefined;
  return eventSlug.split('-')[0];
}
