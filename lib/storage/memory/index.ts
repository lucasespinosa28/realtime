import type { Order, TradeOrder } from "./model";
import { memoryLogger } from "../../../utils/logger";

const reported = new Map();

const storage = {
    getAllIds: () => Array.from(reported.keys()),
    hasId: (id: string) => reported.has(id),
    add: (id: string, data: Order) => {
        memoryLogger.debug("Adding storage entry for {id}: {data}", { id, data });
        return reported.set(id, data);
    },
    get: (id: string): Order => reported.get(id),
    delete: (id: string) => {
        memoryLogger.debug("Deleting storage entry for {id}", { id });
        return reported.delete(id);
    }
}


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

const hedgeMap = {
    getAllIds: () => Array.from(reported.keys()),
    hasId: (id: string) => reported.has(id),
    add: (id: string, data: string) => reported.set(id, data),
    get: (id: string): string => reported.get(id),
    delete: (id: string) => reported.delete(id)
}


const handleId = (tag: string, id: string) => `${tag}${id}`;
const eventsTokens: string[] = [];
export { storage,logger, handleId,storageOrder, eventsTokens, hedgeMap };