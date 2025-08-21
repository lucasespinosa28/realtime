import type { Message } from "../websocket";
import { isTimeMatchLegcy } from "../../utils/time";

/**
 * Checks if the message should be processed
 */
export const shouldProcessMessage = (message: Message, slug: string): boolean => {
    // Early return if not relevant message type
    if (!message?.payload?.slug?.includes(slug)) {
        return false;
    }

    // Check if time matches current ET time
    if (!isTimeMatchLegcy(message.payload.title)) {
        return false;
    }

    return true;
};
