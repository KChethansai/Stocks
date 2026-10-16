// Regression coverage for the test-database boundary.
// Run: npm run test:unit (node --test, zero new dependencies).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dbNameFromUrl, getSeedGuardDecision, getPhase0DropDecision, derivePhase0TestUrl } from '../config/seedGuard.js'

describe('dbNameFromUrl', () => {
  it('extracts the database name without credentials', () => {
    const url = 'mongodb+srv://user:s3cret@cluster.example.net/pwtest_audit?retryWrites=true'
    assert.equal(dbNameFromUrl(url), 'pwtest_audit')
  })

  it('returns empty for missing paths or non-strings', () => {
    assert.equal(dbNameFromUrl(''), '')
    assert.equal(dbNameFromUrl(null), '')
    assert.equal(dbNameFromUrl('mongodb://host/?retryWrites=true'), '')
  })

  it('accepts trailing slashes and multi-host replica-set URLs', () => {
    assert.equal(dbNameFromUrl('mongodb://host/pwtest_audit/'), 'pwtest_audit')
    assert.equal(
      dbNameFromUrl('mongodb://h1,h2,h3/pwtest_audit?replicaSet=rs0'),
      'pwtest_audit'
    )
  })
})

describe('getSeedGuardDecision', () => {
  const app = 'mongodb+srv://u:p@host/devdb?retryWrites=true'

  it('accepts an isolated test database', () => {
    const d = getSeedGuardDecision('mongodb://host/pwtest_audit', app)
    assert.equal(d.ok, true)
    assert.equal(d.dbName, 'pwtest_audit')
  })

  it('refuses missing URLs and non-test names', () => {
    assert.equal(getSeedGuardDecision('', app).ok, false)
    assert.match(getSeedGuardDecision('mongodb://host/stocks', app).reason, /non-test/)
    assert.match(getSeedGuardDecision('mongodb://host/production', app).reason, /non-test|blocked/)
  })

  it('refuses when the seed target equals the application database', () => {
    const same = getSeedGuardDecision('mongodb://host/pwtest_shared', 'mongodb://other/pwtest_shared')
    assert.equal(same.ok, false)
    assert.match(same.reason, /application database/)
  })

  it('does not treat a same-suffix different database as a match', () => {
    const d = getSeedGuardDecision('mongodb://host/pwtest_devdb', 'mongodb://host/devdb')
    assert.equal(d.ok, true)
  })
})

describe('derivePhase0TestUrl', () => {
  const base = 'mongodb+srv://u:p@cluster.example.net/appdb?retryWrites=true'

  it('derives the isolated test URL on the same cluster', () => {
    const d = derivePhase0TestUrl(base, 'phase0test_abc123')
    assert.equal(d.ok, true)
    assert.equal(d.testUrl, 'mongodb+srv://u:p@cluster.example.net/phase0test_abc123?retryWrites=true')
  })

  it('refuses when the base URL has no database path (would target the app DB)', () => {
    const d = derivePhase0TestUrl('mongodb+srv://u:p@cluster.example.net?retryWrites=true', 'phase0test_abc123')
    assert.equal(d.ok, false)
  })

  it('refuses malformed test names and missing input', () => {
    assert.equal(derivePhase0TestUrl(base, 'appdb').ok, false)
    assert.equal(derivePhase0TestUrl(base, '').ok, false)
    assert.equal(derivePhase0TestUrl('', 'phase0test_abc123').ok, false)
  })
})

describe('getPhase0DropDecision', () => {
  it('allows dropping the expected derived database only', () => {
    assert.equal(getPhase0DropDecision('phase0test_abc123', 'phase0test_abc123').ok, true)
  })

  it('refuses mismatched or malformed database names', () => {
    assert.equal(getPhase0DropDecision('devdb', 'phase0test_abc123').ok, false)
    assert.equal(getPhase0DropDecision('devdb', 'devdb').ok, false)
    assert.equal(getPhase0DropDecision('phase0test_abc123', '').ok, false)
  })
})
