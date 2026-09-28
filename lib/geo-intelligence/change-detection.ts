import { event, entity, claim, source, evidence, relationship } from "./types";
import { promises as fs } from "fs";
import { join } from "path";

export type StorageBackend = "memory" | "file" | "redis";

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export interface Snapshot {
  events: Map<string, string>;
  entities: Map<string, string>;
  claims: Map<string, string>;
  sources: Map<string, string>;
  evidences: Map<string, string>;
  relationships: Map<string, string>;
  timestamp: number;
}

export interface ChangeReport {
  newEvents: event[];
  changedEvents: event[];
  resolvedEvents: string[];
  newEntities: entity[];
  changedEntities: entity[];
  newClaims: claim[];
  changedClaims: claim[];
  timestamp: number;
}

function hashContent(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function deepHash(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export class ChangeDetector {
  private snapshots: Map<string, Snapshot> = new Map();
  private readonly storageKey = "akashic_snapshots";
  private readonly maxSnapshots = 50;
  private readonly storagePath: string | null = null;

  constructor(storageBackend: StorageBackend = "memory", storagePath?: string) {
    this.storagePath = storageBackend === "file" ? storagePath ?? join(process.cwd(), "data", "akashic-snapshots.json") : null;
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    try {
      if (this.storageBackend === "file") {
        const stored = await fs.readFile(this.storagePath!, "utf-8");
        const parsed = JSON.parse(stored);
        for (const [key, val] of Object.entries(parsed)) {
          const snapshot = val as any;
          this.snapshots.set(key, {
            events: new Map(snapshot.events),
            entities: new Map(snapshot.entities),
            claims: new Map(snapshot.claims),
            sources: new Map(snapshot.sources),
            evidences: new Map(snapshot.evidences),
            relationships: new Map(snapshot.relationships),
            timestamp: snapshot.timestamp
          });
        }
      } else if (this.storageBackend === "redis") {
        const stored = await this.redisGet(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          for (const [key, val] of Object.entries(parsed)) {
            const snapshot = val as any;
            this.snapshots.set(key, {
              events: new Map(snapshot.events),
              entities: new Map(snapshot.entities),
              claims: new Map(snapshot.claims),
              sources: new Map(snapshot.sources),
              evidences: new Map(snapshot.evidences),
              relationships: new Map(snapshot.relationships),
              timestamp: snapshot.timestamp
            });
          }
        }
      } else if (typeof window !== "undefined") {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          for (const [key, val] of Object.entries(parsed)) {
            const snapshot = val as any;
            this.snapshots.set(key, {
              events: new Map(snapshot.events),
              entities: new Map(snapshot.entities),
              claims: new Map(snapshot.claims),
              sources: new Map(snapshot.sources),
              evidences: new Map(snapshot.evidences),
              relationships: new Map(snapshot.relationships),
              timestamp: snapshot.timestamp
            });
          }
        }
      }
    } catch (e) {
      console.warn("[ChangeDetector] Failed to load snapshots:", e);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const obj: Record<string, any> = {};
      for (const [key, snap] of this.snapshots) {
        obj[key] = {
          events: Array.from(snap.events.entries()),
          entities: Array.from(snap.entities.entries()),
          claims: Array.from(snap.claims.entries()),
          sources: Array.from(snap.sources.entries()),
          evidences: Array.from(snap.evidences.entries()),
          relationships: Array.from(snap.relationships.entries()),
          timestamp: snap.timestamp
        };
      }
      const serialized = JSON.stringify(obj);
      if (this.storageBackend === "file") {
        await fs.mkdir(join(this.storagePath!, ".."), { recursive: true });
        await fs.writeFile(this.storagePath!, serialized, "utf-8");
      } else if (this.storageBackend === "redis") {
        await this.redisSet(this.storageKey, serialized);
      } else if (typeof window !== "undefined") {
        localStorage.setItem(this.storageKey, serialized);
      }
    } catch (e) {
      console.warn("[ChangeDetector] Failed to save snapshots:", e);
    }
  }

  private async redisGet(key: string): Promise<string | null> {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST ? `redis://${process.env.REDIS_URL || process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null;
      if (!redisUrl) return null;
      // Redis client is optional; use in-memory fallback if not available
      return null;
    } catch {
      return null;
    }
  }

  private async redisSet(key: string, value: string): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST ? `redis://${process.env.REDIS_URL || process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null;
      if (!redisUrl) return;
      // Redis client is optional; use in-memory fallback if not available
    } catch {
      return;
    }
  }

  private pruneOldSnapshots(sourceId: string): void {
    const snaps = Array.from(this.snapshots.entries())
      .filter(([k]) => k.startsWith(sourceId))
      .sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    if (snaps.length > this.maxSnapshots) {
      for (let i = this.maxSnapshots; i < snaps.length; i++) {
        this.snapshots.delete(snaps[i][0]);
      }
    }
  }

  captureSnapshot(sourceId: string, data: {
    events: event[];
    entities: entity[];
    claims: claim[];
    sources: source[];
    evidences: evidence[];
    relationships: relationship[];
  }): void {
    const snap: Snapshot = {
      events: new Map(data.events.map(e => [e.id, deepHash(e)])),
      entities: new Map(data.entities.map(e => [e.id, deepHash(e)])),
      claims: new Map(data.claims.map(c => [c.id, deepHash(c)])),
      sources: new Map(data.sources.map(s => [s.id, deepHash(s)])),
      evidences: new Map(data.evidences.map(e => [e.id, deepHash(e)])),
      relationships: new Map(data.relationships.map(r => [r.id, deepHash(r)])),
      timestamp: Date.now()
    };
    this.snapshots.set(`${sourceId}_${Date.now()}`, snap);
    this.pruneOldSnapshots(sourceId);
    this.saveToStorage();
  }

  detectChanges(sourceId: string, currentData: {
    events: event[];
    entities: entity[];
    claims: claim[];
  }): ChangeReport {
    const latestKey = Array.from(this.snapshots.keys())
      .filter(k => k.startsWith(sourceId))
      .sort()
      .pop();

    const report: ChangeReport = {
      newEvents: [],
      changedEvents: [],
      resolvedEvents: [],
      newEntities: [],
      changedEntities: [],
      newClaims: [],
      changedClaims: [],
      timestamp: Date.now()
    };

    if (!latestKey) {
      report.newEvents = currentData.events;
      report.newEntities = currentData.entities;
      report.newClaims = currentData.claims;
      return report;
    }

    const prevSnap = this.snapshots.get(latestKey)!;

    const currentEventHashes = new Map(currentData.events.map(e => [e.id, deepHash(e)]));
    const currentEntityHashes = new Map(currentData.entities.map(e => [e.id, deepHash(e)]));
    const currentClaimHashes = new Map(currentData.claims.map(c => [c.id, deepHash(c)]));

    for (const [id, hash] of currentEventHashes) {
      const prevHash = prevSnap.events.get(id);
      if (!prevHash) {
        report.newEvents.push(currentData.events.find(e => e.id === id)!);
      } else if (prevHash !== hash) {
        report.changedEvents.push(currentData.events.find(e => e.id === id)!);
      }
    }

    for (const [id, hash] of prevSnap.events) {
      if (!currentEventHashes.has(id)) {
        report.resolvedEvents.push(id);
      }
    }

    for (const [id, hash] of currentEntityHashes) {
      const prevHash = prevSnap.entities.get(id);
      if (!prevHash) {
        report.newEntities.push(currentData.entities.find(e => e.id === id)!);
      } else if (prevHash !== hash) {
        report.changedEntities.push(currentData.entities.find(e => e.id === id)!);
      }
    }

    for (const [id, hash] of currentClaimHashes) {
      const prevHash = prevSnap.claims.get(id);
      if (!prevHash) {
        report.newClaims.push(currentData.claims.find(c => c.id === id)!);
      } else if (prevHash !== hash) {
        report.changedClaims.push(currentData.claims.find(c => c.id === id)!);
      }
    }

    return report;
  }

  getHistory(sourceId: string, limit = 10): Snapshot[] {
    return Array.from(this.snapshots.entries())
      .filter(([k]) => k.startsWith(sourceId))
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, limit)
      .map(([, v]) => v);
  }

  clear(sourceId?: string): void {
    if (sourceId) {
      for (const key of this.snapshots.keys()) {
        if (key.startsWith(sourceId)) {
          this.snapshots.delete(key);
        }
      }
    } else {
      this.snapshots.clear();
    }
    this.saveToStorage();
  }
}

export const globalChangeDetector = new ChangeDetector();

export function computeChangeHash(data: any): string {
  return deepHash(data);
}

export function generateEventFingerprint(event: event): string {
  const relevant = {
    title: event.title,
    summary: event.summary,
    category: event.category,
    severity: event.severity,
    location_id: event.location_id,
    start_time: event.start_time
  };
  return deepHash(relevant);
}

export function generateEntityFingerprint(entity: entity): string {
  const relevant = {
    name: entity.name,
    type: entity.type,
    country_iso: entity.country_iso,
    metadata: entity.metadata
  };
  return deepHash(relevant);
}

export function generateClaimFingerprint(claim: claim): string {
  const relevant = {
    text: claim.text,
    type: claim.type,
    status: claim.status,
    confidence: claim.confidence
  };
  return deepHash(relevant);
}
