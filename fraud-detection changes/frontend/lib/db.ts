import Dexie, { type Table } from 'dexie';
import type { PipelineDecision, StreamLogEntry } from './pipeline/types';

export interface AuditRecord extends PipelineDecision {
  syncedAt?: number;
}

export class FraudIQDatabase extends Dexie {
  transactions!: Table<PipelineDecision, string>;
  audit!: Table<AuditRecord, string>;
  streamLogs!: Table<StreamLogEntry, string>;

  constructor() {
    super('FraudIQ_OS');
    this.version(1).stores({
      transactions: 'id, txnId, accountId, outcome, timestamp, pFraud, amlCategory',
      audit: 'id, txnId, accountId, outcome, timestamp, pFraud',
      streamLogs: 'id, timestamp',
    });
  }
}

export const db = typeof window !== 'undefined' ? new FraudIQDatabase() : null;

export async function persistDecision(decision: PipelineDecision): Promise<void> {
  if (!db) return;
  await db.transactions.put(decision);
  await db.audit.put({ ...decision, syncedAt: Date.now() });
}

export async function persistStreamLog(entry: StreamLogEntry): Promise<void> {
  if (!db) return;
  await db.streamLogs.put(entry);
  const count = await db.streamLogs.count();
  if (count > 5000) {
    const oldest = await db.streamLogs.orderBy('timestamp').limit(500).primaryKeys();
    await db.streamLogs.bulkDelete(oldest);
  }
}

export async function queryAudit(filters: {
  txnId?: string;
  accountId?: string;
  outcome?: string;
  minPFraud?: number;
  from?: number;
  to?: number;
  limit?: number;
}): Promise<AuditRecord[]> {
  if (!db) return [];
  let coll = db.audit.orderBy('timestamp').reverse();
  const all = await coll.toArray();

  return all
    .filter((r) => {
      if (filters.txnId && !r.txnId.toLowerCase().includes(filters.txnId.toLowerCase())) return false;
      if (filters.accountId && !r.accountId.toLowerCase().includes(filters.accountId.toLowerCase()))
        return false;
      if (filters.outcome && filters.outcome !== 'ALL' && r.outcome !== filters.outcome) return false;
      if (filters.minPFraud != null && r.pFraud < filters.minPFraud) return false;
      if (filters.from && r.timestamp < filters.from) return false;
      if (filters.to && r.timestamp > filters.to) return false;
      return true;
    })
    .slice(0, filters.limit ?? 200);
}

export async function getRecentTransactions(limit = 200): Promise<PipelineDecision[]> {
  if (!db) return [];
  return db.transactions.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function getHighRiskLedger(hours = 1, limit = 20): Promise<PipelineDecision[]> {
  if (!db) return [];
  const since = Date.now() - hours * 3600_000;
  const rows = await db.transactions.where('timestamp').above(since).reverse().sortBy('timestamp');
  return rows
    .filter((r) => r.pFraud >= 0.55 || r.outcome === 'BLOCK' || r.outcome === 'MANUAL_REVIEW')
    .sort((a, b) => b.pFraud - a.pFraud)
    .slice(0, limit);
}
