interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class TtlCache<K, V> {
    private store = new Map<K, CacheEntry<V>>();

    constructor(private defaultTtlMs: number) {}

    set(key: K, value: V, ttlMs = this.defaultTtlMs) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    get(key: K): V | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    delete(key: K) {
        this.store.delete(key);
    }
}
