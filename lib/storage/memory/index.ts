const reported = new Map();

const storage = {
    trades: {
        getAllIds: () => Array.from(reported.keys()),
        hasId: (id: string) => reported.has(id),
        add: (id: string, data: boolean) => reported.set(id, data),
        get: (id: string) => reported.get(id),
        delete: (id: string) => reported.delete(id),
    },
    order: {
        getAllIds: () => Array.from(reported.keys()),
        hasId: (id: string) => reported.has(id),
        add: (id: string, data: string) => reported.set(id, data),
        get: (id: string) => reported.get(id),
        delete: (id: string) => reported.delete(id),
    }
};

export default storage;