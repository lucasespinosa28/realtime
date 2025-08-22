import type { TradeOrder } from "./model";
import { memoryLogger } from "../../../utils/logger";

const reported = new Map();


const storageOrder = {
    getAllIds: () => Array.from(reported.keys()),
    hasId: (id: string) => reported.has(id),
    add: (id: string, data: TradeOrder) => {
        memoryLogger.debug("Adding order storage entry for {id}: status={status}, orderID={orderID}, conditionId={conditionId}", { 
            id, 
            status: data.status, 
            orderID: data.orderID, 
            conditionId: data.conditionId 
        });
        return reported.set(id, data);
    },
    get: (id: string): TradeOrder => reported.get(id),
    delete: (id: string) => {
        memoryLogger.debug("Deleting order storage entry for {id}", { id });
        return reported.delete(id);
    }
}

const logger = {
    getAllIds: () => Array.from(reported.keys()),
    hasId: (id: string) => reported.has(id),
    add: (id: string, data: boolean) => reported.set(id, data),
    get: (id: string): boolean => reported.get(id),
    delete: (id: string) => reported.delete(id)
}

const eventsTokens: string[] = [];
export { logger,storageOrder, eventsTokens, };