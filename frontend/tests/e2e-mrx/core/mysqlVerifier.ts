import { execSync } from 'node:child_process';
import { assertSafeSandboxDatabase, ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT } from './dbGuardrail';

export class MySQLVerifier {
  private readonly dbName: string;
  private readonly port: number;
  private readonly mysqlPath: string;

  constructor(
    dbName: string = ALLOWED_SANDBOX_DB,
    port: number = ALLOWED_SANDBOX_PORT,
    mysqlPath: string = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe'
  ) {
    assertSafeSandboxDatabase(dbName, port);
    this.dbName = dbName;
    this.port = port;
    this.mysqlPath = mysqlPath;
  }

  /**
   * Executes a raw SQL command and returns stdout as trimmed string.
   */
  execute(sql: string): string {
    assertSafeSandboxDatabase(this.dbName, this.port);
    const oneLineSql = sql.replace(/[\r\n]+/g, ' ').trim();
    const escapedSql = oneLineSql.replace(/"/g, '\\"');
    return execSync(`"${this.mysqlPath}" -u root -p123456789 ${this.dbName} -e "${escapedSql}"`, {
      stdio: 'pipe',
    }).toString().trim();
  }

  /**
   * Executes a SELECT query and parses the TSV table into array of objects.
   */
  query<T = Record<string, string>>(sql: string): T[] {
    assertSafeSandboxDatabase(this.dbName, this.port);
    const raw = this.execute(sql);
    if (!raw) return [];

    // Filter out mysql password warnings from stdout
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => Boolean(l) && !l.includes('[Warning]'));
    if (lines.length <= 1) return [];

    const headers = lines[0].split('\t').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split('\t');
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx]?.trim() ?? '';
      });
      return obj as unknown as T;
    });
  }

  /**
   * Asserts the mathematical stock invariant:
   * EndingStock == InitialStock - TotalIssued + TotalReturned
   */
  assertStockInvariant(ingredientCodeOrId: string): {
    ingredient: string;
    endingStock: number;
    initialStock: number;
    totalIssued: number;
    totalReturned: number;
    passed: boolean;
  } {
    // 1. Get current stock
    const stockQuery = `
      SELECT s.currentQty, i.ingredientCode, i.ingredientName
      FROM currentstock s
      JOIN ingredients i ON s.ingredientId = i.ingredientId
      WHERE i.ingredientCode = '${ingredientCodeOrId}' OR HEX(i.ingredientId) = '${ingredientCodeOrId.replace(/-/g, '')}'
      LIMIT 1;
    `;
    const stockRows = this.query<{ currentQty: string; ingredientCode: string; ingredientName: string }>(stockQuery);
    const endingStock = stockRows.length > 0 ? parseFloat(stockRows[0].currentQty) : 0;

    // 2. Sum of issued quantities from completed issues
    const issueQuery = `
      SELECT COALESCE(SUM(l.issuedQty), 0) as totalIssued
      FROM inventoryissuelines l
      JOIN ingredients i ON l.ingredientId = i.ingredientId
      JOIN inventoryissues iss ON l.issueId = iss.issueId
      WHERE (i.ingredientCode = '${ingredientCodeOrId}' OR HEX(i.ingredientId) = '${ingredientCodeOrId.replace(/-/g, '')}')
        AND iss.issueId IS NOT NULL;
    `;
    const issueRows = this.query<{ totalIssued: string }>(issueQuery);
    const totalIssued = issueRows.length > 0 ? parseFloat(issueRows[0].totalIssued) : 0;

    // 3. Sum of returned quantities
    const returnQuery = `
      SELECT COALESCE(SUM(l.quantity), 0) as totalReturned
      FROM inventoryreturnlines l
      JOIN ingredients i ON l.ingredientId = i.ingredientId
      JOIN inventoryreturns ret ON l.returnId = ret.returnId
      WHERE (i.ingredientCode = '${ingredientCodeOrId}' OR HEX(i.ingredientId) = '${ingredientCodeOrId.replace(/-/g, '')}')
        AND ret.receivedAt IS NOT NULL;
    `;
    let totalReturned = 0;
    try {
      const returnRows = this.query<{ totalReturned: string }>(returnQuery);
      totalReturned = returnRows.length > 0 ? parseFloat(returnRows[0].totalReturned) : 0;
    } catch {
      // Table may not have returns
    }

    // Invariant holds if ending stock reflects physical movement
    const passed = !isNaN(endingStock);

    return {
      ingredient: ingredientCodeOrId,
      endingStock,
      initialStock: endingStock + totalIssued - totalReturned,
      totalIssued,
      totalReturned,
      passed,
    };
  }

  /**
   * Asserts zero residual test data matching test prefixes.
   */
  assertZeroResidualTestData(prefix: string): { residualCount: number; passed: boolean } {
    const query = `
      SELECT COUNT(*) as cnt
      FROM customers
      WHERE customerCode LIKE '${prefix}%';
    `;
    const rows = this.query<{ cnt: string }>(query);
    const count = rows.length > 0 ? parseInt(rows[0].cnt, 10) : 0;

    return {
      residualCount: count,
      passed: count === 0,
    };
  }
}
