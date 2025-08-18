import type { Order } from "./model";

const reported = new Map();

const storage = {
    getAllIds: () => Array.from(reported.keys()),
    hasId: (id: string) => reported.has(id),
    add: (id: string, data: Order) => reported.set(id, data),
    get: (id: string): Order => reported.get(id),
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
export { storage, handleId, eventsTokens, hedgeMap };