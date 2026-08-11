export const WEB_FONT_CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry<Value> {
  expiresAt: number;
  value: Value;
}

export class TtlCache<Value> {
  private entry: CacheEntry<Value> | undefined;
  private pending: Promise<Value> | undefined;

  constructor(
    private readonly ttlMs = WEB_FONT_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad(loader: () => Promise<Value>): Promise<Value> {
    if (this.entry && this.entry.expiresAt > this.now()) {
      return this.entry.value;
    }

    if (this.pending) {
      return this.pending;
    }

    const pending = loader()
      .then((value) => {
        this.entry = {
          expiresAt: this.now() + this.ttlMs,
          value,
        };

        return value;
      })
      .finally(() => {
        if (this.pending === pending) {
          this.pending = undefined;
        }
      });

    this.pending = pending;

    return pending;
  }

  clear(): void {
    this.entry = undefined;
    this.pending = undefined;
  }
}

export class TtlMapCache<Key, Value> {
  private readonly caches = new Map<Key, TtlCache<Value>>();

  constructor(
    private readonly ttlMs = WEB_FONT_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  getOrLoad(key: Key, loader: () => Promise<Value>): Promise<Value> {
    let cache = this.caches.get(key);

    if (!cache) {
      cache = new TtlCache(this.ttlMs, this.now);
      this.caches.set(key, cache);
    }

    return cache.getOrLoad(loader);
  }

  clear(): void {
    this.caches.clear();
  }
}

