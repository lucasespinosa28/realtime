
import { RealTimeDataClient } from "./src/client";
import type { Message } from "./src/model";
import Airtable from "airtable";

const baseId = process.env.BASE_ID;
const apiKey = process.env.API_KEY;

if (!baseId) {
  throw new Error('Missing BASE_ID environment variable');
}
if (!apiKey) {
  throw new Error('Missing API_KEY environment variable');
}

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: apiKey
});
const base = Airtable.base(baseId);

function getFormattedLocalTime(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        month: "long",
        day: "numeric",
        hour: "numeric",
        hour12: true,
        timeZone: "America/New_York",
        timeZoneName: "short"
    };
    // Format: "August 5, 1 PM EDT"
    let formatted = new Intl.DateTimeFormat("en-US", options).format(now);
    return formatted;
}

function parseTitleTime(title: string): { month: string, day: number, hour: number, ampm: string } | null {
    // Example: "Solana Up or Down - August 5, 6PM ET"
    const match = title.match(/([A-Za-z]+) (\d+), (\d+)(AM|PM) ET/i);
    if (!match) return null;
    return {
        month: match[1],
        day: parseInt(match[2], 10),
        hour: parseInt(match[3], 10),
        ampm: match[4].toUpperCase(),
    };
}

function getCurrentETParts(): { month: string, day: number, hour: number, ampm: string } {
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

// In-memory cache for last 64 unique IDs
const recentIds: string[] = [];

const onMessage = async (_client: any, message: Message): Promise<void> => {

    if (message.payload.slug.includes("up-or-down")) {
        //console.log("[TITLE]", message.payload.title);
        const localTime = getFormattedLocalTime();
        //console.log("[LOCAL]", localTime);
        // Compare time in title to local ET time
        const titleParts = parseTitleTime(message.payload.title);
        const etParts = getCurrentETParts();
        if (titleParts) {
            // Compare month (case-insensitive), day, hour, ampm
            const monthsEqual = titleParts.month.toLowerCase() === etParts.month.toLowerCase();
            const daysEqual = titleParts.day === etParts.day;
            const hoursEqual = titleParts.hour === etParts.hour;
            const ampmEqual = titleParts.ampm === etParts.ampm;
            if (monthsEqual && daysEqual && hoursEqual && ampmEqual) {
                const id = message.payload.conditionId;
                const price = message.payload.price;
                const event = message.payload.eventSlug;
                const outcome = message.payload.outcome;
                const url = `https://polymarket.com/event/${event}`;

                //console.log("[MATCH] Local ET time matches time in title!");
                //console.log("[MESSAGE]",outcome, price);
                if (message.payload.price > 0.9) {
                    // Check in-memory array for duplicate
                    if (!recentIds.includes(id)) {
                        // Maintain max 64 entries
                        if (recentIds.length >= 64) {
                            recentIds.shift(); // Remove oldest
                        }
                        recentIds.push(id);
                        // Save to Airtable
                        base('Table 1').create([
                          {
                            fields: {
                              id,
                              price,
                              event,
                              outcome,
                              url
                            }
                          }
                        ], function(err, records) {
                          if (err) {
                            //console.error('[Airtable] Error:', err);
                            return;
                          }
                          if (records) {
                            records.forEach(function(record) {
                              //console.log('[Airtable] Created record:', record.getId());
                            });
                          }
                        });
                    } else {
                        //console.log(`[Airtable] Skipped duplicate id: ${id}`);
                    }
                }
            } else {
                //console.log("[NO MATCH] Local ET time does not match time in title.");
            }
        } else {
            //console.log("[WARN] Could not parse time from title.");
        }
    }
};

const onStatusChange = (status: any) => {
    console.log("[STATUS]", status);
};

const onConnect = (client: RealTimeDataClient): void => {
    // Subscribe to a topic
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
            },
        ],
    })
};

new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();

