# Enforcing one open supplemental request per issue line (MySQL 8)

## Finding

The service is configured for Pomelo with MySQL `8.0.36`; use an InnoDB `UNIQUE`
index over a generated, nullable `issueLineId` projection. MySQL has no partial
unique-index `WHERE` predicate. This pattern makes only an **open** request
produce a key value, while terminal history produces `NULL` and remains
unlimited.

```sql
ALTER TABLE supplementalmaterialrequests
  ADD COLUMN openIssueLineId BINARY(16)
    GENERATED ALWAYS AS (
      CASE
        WHEN status IN ('REJECTED', 'FULFILLED') THEN NULL
        ELSE issueLineId
      END
    ) VIRTUAL,
  ADD UNIQUE KEY uqSupplementalMaterialRequestsOpenIssueLine (openIssueLineId);
```

The current service's terminal states are `REJECTED` and `FULFILLED`; use the
authoritative terminal set in the expression. `issueLineId` is already
required, so every non-terminal row has one non-`NULL` key and at most one can
exist. When a row becomes terminal, its generated key becomes `NULL`; a later
request for that issue line is then permitted. If a new terminal state is
introduced, update this expression in the same migration/change so it too
releases the key.

## Why this works

- A MySQL `UNIQUE` index rejects duplicate non-`NULL` keys, but explicitly
  permits multiple `NULL` values. Therefore a bare unique key such as
  `(issueLineId, nullableOpenMarker)` is unsafe if the marker is `NULL` for
  open rows; the generated expression must return the non-`NULL` issue-line ID
  for precisely the rows being constrained. [MySQL 8.0: `CREATE INDEX` —
  unique indexes](https://dev.mysql.com/doc/refman/8.0/en/create-index.html)
- MySQL supports secondary indexes on virtual generated columns, so the
  virtual column need not consume clustered-row storage; indexed generated
  values still have index storage and write-maintenance cost. A stored
  generated column is also valid when operational tooling/provider support
  makes it preferable. [MySQL 8.0: `CREATE TABLE` — generated columns and
  indexes](https://dev.mysql.com/doc/refman/8.0/en/create-table.html)
- MySQL 8.0.13+ also supports `UNIQUE` functional key parts, implemented with
  hidden virtual generated columns. The explicit generated column above is
  clearer for schema inspection and EF migrations; do not depend on it being
  portable to a provider's migration API. [MySQL 8.0: functional key
  parts](https://dev.mysql.com/doc/refman/8.0/en/create-index.html)

## Transaction and error handling

Treat the index as the final concurrency boundary. The create operation can
pre-check only to give an early user-facing answer, but it must still attempt
the insert in its normal transaction and translate a duplicate-key failure into
the domain result "an open supplemental request already exists". Do not use
`INSERT IGNORE`, `REPLACE`, or an unconditional upsert: each can obscure or
mutate the conflict rather than preserve request history.

For InnoDB, a duplicate-key failure rolls back the failed statement, not
automatically the whole transaction, and statement rollback does not release
locks. Roll back or otherwise finish the unit of work deliberately before
returning the conflict. A deadlock rolls back the whole transaction and should
retry the whole, idempotent create operation; a lock-wait timeout normally
rolls back only the statement and requires the matching retry policy.
[MySQL: InnoDB error handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)

## Migration caveats and verification

1. Before adding the unique index, find and resolve every duplicate whose
   status is not terminal. The DDL must not silently choose a winner.
2. Add it through a reviewed migration. If the EF/Pomelo generated-column
   mapping cannot emit this exact DDL, use migration SQL and keep the model
   snapshot/mapping aligned; do not make application-level checking the only
   safeguard.
3. Test two concurrent creates for the same `issueLineId` (exactly one
   succeeds), terminal transition then recreate (succeeds), and every terminal
   status (allows historical duplicates). Also test status transitions that
   would create a second open key: they must fail until the other request is
   terminal.
4. Keep the create transaction small and make retryable writes idempotent.
   MySQL documents deadlocks and lock waits as normal on busy servers and says
   applications must handle them with retries. [MySQL 8.0: InnoDB
   deadlocks](https://dev.mysql.com/doc/refman/8.0/en/innodb-deadlocks.html)

## MariaDB compatibility

MariaDB documents the same key facts: `UNIQUE` indexes allow multiple `NULL`
values, and both virtual and persistent/stored generated columns can be
indexed. Its explicit virtual-column conditional-uniqueness example confirms
the pattern, but DDL syntax/version support must be checked against the
deployed MariaDB release before using it as a fallback.

- [MariaDB: NULL values](https://mariadb.com/docs/server/reference/data-types/null-values)
- [MariaDB: indexes and conditional uniqueness](https://mariadb.com/docs/server/server-usage/tables/mariadb-indexes-guide-1)
- [MariaDB: generated columns](https://mariadb.com/docs/server/reference/sql-statements/data-definition/create/generated-columns)
