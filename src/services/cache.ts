import { createHash } from "crypto";

/**
 * Doubly-linked list node for O(1) LRU eviction
 */
interface Node<V> {
  key: string;
  value: V;
  prev: Node<V> | null;
  next: Node<V> | null;
  expiresAt: number;
}

/**
 * In-memory LRU cache with TTL support.
 * Evicts the least-recently-used entry when capacity is exceeded.
 */
export class LRUCache<V> {
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, Node<V>>();
  // Sentinel head/tail nodes simplify list manipulation
  private readonly head: Node<V>;
  private readonly tail: Node<V>;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.head = {
      key: "",
      value: null as unknown as V,
      prev: null,
      next: null,
      expiresAt: 0,
    };
    this.tail = {
      key: "",
      value: null as unknown as V,
      prev: null,
      next: null,
      expiresAt: 0,
    };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    if (Date.now() > node.expiresAt) {
      this.remove(node);
      return undefined;
    }
    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = Date.now() + this.ttlMs;
      this.moveToFront(existing);
      return;
    }

    const node: Node<V> = {
      key,
      value,
      prev: null,
      next: null,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.map.set(key, node);
    this.insertAtFront(node);

    if (this.map.size > this.capacity) {
      this.evictLRU();
    }
  }

  get size(): number {
    return this.map.size;
  }

  /** Visible for testing */
  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private insertAtFront(node: Node<V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private remove(node: Node<V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    this.map.delete(node.key);
  }

  private moveToFront(node: Node<V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    this.insertAtFront(node);
  }

  private evictLRU(): void {
    const lru = this.tail.prev!;
    if (lru === this.head) return;
    this.remove(lru);
  }
}

/**
 * Build a deterministic cache key from XDR + network using SHA-256.
 */
export function buildCacheKey(xdr: string, network: string): string {
  return createHash("sha256").update(`${xdr}:${network}`).digest("hex");
}
