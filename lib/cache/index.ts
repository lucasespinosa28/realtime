export class CacheManager {
    private recentIds = new Set<string>();
    private readonly maxCacheSize: number;

    constructor(maxCacheSize: number = 32) {
        this.maxCacheSize = maxCacheSize;
    }

    /**
     * Manages cache size and adds new ID
     */
    addId(id: string): void {
        // Maintain max cache size for recentIds
        if (this.recentIds.size >= this.maxCacheSize) {
            // Clear half the cache to prevent constant clearing
            const idsArray = Array.from(this.recentIds);
            this.recentIds.clear();
            // Keep the second half
            for (let i = Math.floor(idsArray.length / 2); i < idsArray.length; i++) {
                this.recentIds.add(idsArray[i]);
            }
        }
        this.recentIds.add(id);
    }

    /**
     * Performs periodic cleanup of cache and memory
     */
    performCleanup(): void {
        if (this.recentIds.size > this.maxCacheSize) {
            this.recentIds.clear();
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }

    hasId(id: string): boolean {
        return this.recentIds.has(id);
    }

    /**
     * Atomically checks if ID exists and adds it if not.
     * Returns true if ID was added (first time seeing it), false if it already existed.
     */
    checkAndAdd(id: string): boolean {
        if (this.recentIds.has(id)) {
            return false; // ID already exists
        }
        
        // Maintain max cache size before adding
        if (this.recentIds.size >= this.maxCacheSize) {
            // Clear half the cache to prevent constant clearing
            const idsArray = Array.from(this.recentIds);
            this.recentIds.clear();
            // Keep the second half
            for (let i = Math.floor(idsArray.length / 2); i < idsArray.length; i++) {
                this.recentIds.add(idsArray[i]);
            }
        }
        
        this.recentIds.add(id);
        return true; // ID was added
    }

    get size(): number {
        return this.recentIds.size;
    }

    getAllIds(): string[] {
        return Array.from(this.recentIds);
    }
}

// Export legacy functions for backward compatibility
const defaultCache = new CacheManager();

export const manageCacheAndAddId = (id: string): void => defaultCache.addId(id);
export const performCleanup = (): void => defaultCache.performCleanup();
export const recordHasId = (id: string): boolean => defaultCache.hasId(id);