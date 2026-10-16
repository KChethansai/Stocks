// Test-database guard for destructive test scripts (seed, phase0 verify).
// Pure + side-effect free so it can be unit-tested with `node --test`.
//
// Policy:
// - A seed target must explicitly look isolated: its database name must
//   contain "test" (case-insensitive) and it must have a database path.
// - A seed target must never equal the application's own DB_URL database
//   (dev or production): an operator copy-pasting the app URL into
//   PWTEST_DB_URL gets a refusal, not a poisoned database.
// - Well-known non-test database names are refused with an explicit reason
//   even if a future caller relaxes the "test" substring rule.
const BLOCKED_NAMES = new Set(['prod', 'production', 'live', 'main', 'master', 'marketforge', 'stocks'])

export function dbNameFromUrl(url) {
  if (typeof url !== 'string' || !url) return ''
  // Strip scheme + authority FIRST (credentials included, so they can never
  // leak into logs or error strings). What remains starts at the path: a
  // host-only URL ('...@host?opts') leaves '?opts' with no leading slash,
  // which must NOT be mistaken for a database name.
  const path = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*/, '')
  // Accept an optional trailing slash; multi-host replica-set URLs resolve
  // to the final path segment (the database name).
  const m = path.match(/^\/([^/?]+)\/?(\?|$)/)
  return (m || [])[1] || ''
}

export function getSeedGuardDecision(seedUrl, appDbUrl = '') {
  if (!seedUrl) return { ok: false, reason: 'PWTEST_DB_URL missing', dbName: '' }
  const dbName = dbNameFromUrl(seedUrl)
  if (!dbName) return { ok: false, reason: 'PWTEST_DB_URL has no database path', dbName: '' }
  if (!/test/i.test(dbName)) {
    return { ok: false, reason: `Refusing to seed non-test database "${dbName}"`, dbName }
  }
  // NOTE: the "test" substring alone is a coarse filter (names like
  // "latest" also match). The real production protection is the equality
  // check below: the seed target must never be the application's own
  // database, whatever its name.
  if (BLOCKED_NAMES.has(dbName.toLowerCase())) {
    return { ok: false, reason: `Refusing to seed blocked database "${dbName}"`, dbName }
  }
  if (appDbUrl) {
    const appDb = dbNameFromUrl(appDbUrl)
    if (appDb && appDb.toLowerCase() === dbName.toLowerCase()) {
      return {
        ok: false,
        reason: `PWTEST_DB_URL targets the application database "${dbName}" — supply an isolated test database`,
        dbName,
      }
    }
  }
  return { ok: true, reason: '', dbName }
}

// Derives the Phase 0 test-database URL from the configured base URL.
// Fails closed when the base URL carries no database path: without this,
// String.replace would be a no-op and the verifier would connect to — and
// write fixtures into — the configured database itself.
export function derivePhase0TestUrl(baseUrl, testDb) {
  if (!baseUrl) return { ok: false, reason: 'DB_URL missing', testUrl: '' }
  if (!/^phase0test_[a-z0-9]+$/i.test(testDb || '')) {
    return { ok: false, reason: `Unexpected phase0 database "${testDb}"`, testUrl: '' }
  }
  if (!dbNameFromUrl(baseUrl)) {
    return { ok: false, reason: 'DB_URL has no database path — refusing to derive a test database', testUrl: '' }
  }
  const testUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, `/${testDb}$2`)
  if (testUrl === baseUrl || dbNameFromUrl(testUrl) !== testDb) {
    return { ok: false, reason: 'Test URL derivation failed — refusing to connect', testUrl: '' }
  }
  return { ok: true, reason: '', testUrl }
}
export function getPhase0DropDecision(connectionDbName, expectedDbName) {
  if (!expectedDbName || !/^phase0test_[a-z0-9]+$/i.test(expectedDbName)) {
    return { ok: false, reason: `Unexpected phase0 database "${expectedDbName}"` }
  }
  if (connectionDbName !== expectedDbName) {
    return {
      ok: false,
      reason: `Connected to "${connectionDbName}" but expected "${expectedDbName}" — refusing to drop`,
    }
  }
  return { ok: true, reason: '' }
}
