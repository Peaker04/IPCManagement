import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import {
  ALLOWED_SANDBOX_PORT,
  assertSafeMrxE2eDatabase,
  resolveMrxE2eDatabase,
} from './dbGuardrail';

export type StockSnapshot = {
  ingredientId: string; unitId: string; warehouseId: string; currentQty: string;
  lots: ReadonlyArray<{ lotId: string; quantity: string }>; movementIds: readonly string[];
};

function decimalMicros(value: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('Expected a non-negative decimal with at most six fractional digits.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function assertStockDelta(before: StockSnapshot, after: StockSnapshot,
  expected: { issuedBaseQty: string; receivedReturnBaseQty: string; provisionedBaseQty?: string; trackedReturnBaseQty?: string }): void {
  for (const field of ['ingredientId', 'unitId', 'warehouseId'] as const) {
    if (!before[field] || before[field] !== after[field]) throw new Error(`Stock ${field} scope changed.`);
  }
  const delta = decimalMicros(expected.receivedReturnBaseQty) + decimalMicros(expected.provisionedBaseQty ?? '0') - decimalMicros(expected.issuedBaseQty);
  const opening = decimalMicros(before.currentQty);
  const closing = decimalMicros(after.currentQty);
  if (closing !== opening + delta) throw new Error('Physical stock does not match the independently declared movement delta.');
  for (const snapshot of [before, after]) {
    if (new Set(snapshot.lots.map((lot) => lot.lotId)).size !== snapshot.lots.length) throw new Error('Duplicate lot identities.');
    if (snapshot.lots.reduce((sum, lot) => sum + decimalMicros(lot.quantity), 0n) > decimalMicros(snapshot.currentQty)) {
      throw new Error('Known lots exceed physical stock.');
    }
    if (new Set(snapshot.movementIds).size !== snapshot.movementIds.length) throw new Error('Duplicate movement identities.');
  }
  const openingTracked = before.lots.reduce((sum, lot) => sum + decimalMicros(lot.quantity), 0n);
  const closingTracked = after.lots.reduce((sum, lot) => sum + decimalMicros(lot.quantity), 0n);
  const issued = decimalMicros(expected.issuedBaseQty);
  const trackedReturn = decimalMicros(expected.trackedReturnBaseQty ?? '0');
  if (trackedReturn > decimalMicros(expected.receivedReturnBaseQty)
    || closingTracked !== openingTracked - (issued < openingTracked ? issued : openingTracked) + trackedReturn) {
    throw new Error('Known lot delta does not match FEFO consumption and declared tracked returns.');
  }
  const retained = new Set(after.movementIds);
  if (before.movementIds.some((id) => !retained.has(id))) throw new Error('Retained stock movement disappeared.');
  if ((decimalMicros(expected.issuedBaseQty) > 0n || decimalMicros(expected.receivedReturnBaseQty) > 0n)
    && after.movementIds.length <= before.movementIds.length) throw new Error('Expected durable movement is missing.');
}

export class MySQLVerifier {
  private readonly dbName: string;
  private readonly port: number;
  private readonly mysqlPath: string;
  private readonly defaultsFile: string;

  constructor(
    dbName: string = resolveMrxE2eDatabase(process.env).database,
    port: number = ALLOWED_SANDBOX_PORT,
    mysqlPath: string = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe',
    defaultsFile: string = process.env.IPC_MRX_MYSQL_DEFAULTS_FILE ?? ''
  ) {
    assertSafeMrxE2eDatabase(dbName, port, process.env);
    if (!defaultsFile || !fs.existsSync(defaultsFile)) {
      throw new Error('[FATAL CONFIGURATION ERROR] IPC_MRX_MYSQL_DEFAULTS_FILE must name an existing run-owned file.');
    }
    this.dbName = dbName;
    this.port = port;
    this.mysqlPath = mysqlPath;
    this.defaultsFile = defaultsFile;
  }

  execute(sql: string): string {
    assertSafeMrxE2eDatabase(this.dbName, this.port, process.env);
    return execFileSync(this.mysqlPath, [
      `--defaults-extra-file=${this.defaultsFile}`,
      this.dbName,
      '--execute',
      sql.replace(/[\r\n]+/g, ' ').trim(),
    ], { stdio: 'pipe' }).toString().trim();
  }

  query<T = Record<string, string>>(sql: string): T[] {
    const raw = this.execute(sql);
    if (!raw) return [];
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) return [];
    const headers = lines[0].split('\t').map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const values = line.split('\t');
      return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])) as T;
    });
  }

  captureStockSnapshot(ingredientId: string): StockSnapshot {
    if (!/^[A-Fa-f0-9]{32}$/.test(ingredientId)) throw new Error('Stock oracle requires the exact persisted binary ingredient ID.');
    const rows = this.query<{ snapshot: string }>(`
      SELECT JSON_OBJECT('ingredientId',HEX(s.ingredientId),'unitId',HEX(s.unitId),'warehouseId',HEX(s.warehouseId),
        'currentQty',CAST(s.currentQty AS CHAR),
        'lots',COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('lotId',HEX(l.lotStockId),'quantity',CAST(l.currentQty AS CHAR)))
          FROM currentstocklots l WHERE l.ingredientId=s.ingredientId AND l.warehouseId=s.warehouseId AND l.unitId=s.unitId),JSON_ARRAY()),
        'movementIds',COALESCE((SELECT JSON_ARRAYAGG(HEX(m.movementId)) FROM stockmovements m
          WHERE m.ingredientId=s.ingredientId AND m.warehouseId=s.warehouseId AND m.unitId=s.unitId),JSON_ARRAY())) AS snapshot
      FROM currentstock s JOIN warehouses w ON w.warehouseId=s.warehouseId AND w.IsOperationalActive=1
      WHERE s.ingredientId=UNHEX('${ingredientId}');`);
    if (rows.length !== 1) throw new Error('Stock oracle requires one existing operational stock row; missing stock is not zero.');
    const snapshot = JSON.parse(rows[0].snapshot) as StockSnapshot;
    assertStockDelta(snapshot, snapshot, { issuedBaseQty: '0', receivedReturnBaseQty: '0' });
    return snapshot;
  }

  assertZeroResidualTestData(prefix: string): { residualCount: number; passed: boolean } {
    const rows = this.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM customers WHERE customerCode LIKE '${prefix}%';`
    );
    const residualCount = Number.parseInt(rows[0]?.cnt ?? '0', 10);
    return { residualCount, passed: residualCount === 0 };
  }
}
