import type { Message } from "../websocket";
import { isTimeMatch } from "../../utils/time";

/**
 * Checks if the message should be processed
 */
export const shouldProcessMessage = (message: Message, slug: string): boolean => {
    // Early return if not relevant message type
    if (!message?.payload?.slug?.includes(slug)) {
        return false;
    }

    // Check if time matches current ET time
    if (!isTimeMatch(message.payload.title)) {
        return false;
    }

    return true;
};
