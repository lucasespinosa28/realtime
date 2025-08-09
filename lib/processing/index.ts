import type { Message } from "../websocket";
import { isTimeMatch } from "../../utils/time";


const text = process.env.SLUG;
if (!text) {
  throw new Error('Missing SLUG environment variable');
}
/**
 * Checks if the message should be processed
 */
export const shouldProcessMessage = (message: Message): boolean => {
    // Early return if not relevant message type
    if (!message?.payload?.slug?.includes(text)) {
        return false;
    }

    // Check if time matches current ET time
    if (!isTimeMatch(message.payload.title)) {
        return false;
    }

    return true;
};
