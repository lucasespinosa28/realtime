import { reconnectWithFreshData } from "./reconnectWithFreshData";
import { appLogger } from "../../utils/logger";

/**
 * Setup hourly reload at minute 00
 */
export function setupHourlyReload(): void {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    appLogger.info("Next reload scheduled at: {time}", { time: nextHour.toISOString() });

    // Schedule first reload
    setTimeout(async () => {
        await reconnectWithFreshData();

        // Then schedule every hour
        setInterval(async () => {
            await reconnectWithFreshData();
        }, 60 * 60 * 1000); // 1 hour in milliseconds

    }, msUntilNextHour);
}
