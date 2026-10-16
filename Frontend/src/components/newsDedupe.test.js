// Regression coverage for news deduplication (Oct 2026).
// The same Yahoo article is returned for every queried symbol it mentions;
// merging per-symbol feeds without canonical identity repeats headlines.
// Run: node --test src/components/newsDedupe.test.js (zero new deps).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalArticleKey, dedupeNews } from './newsDedupe.js'

const article = (over = {}) => ({
  title: 'Stock market today: futures mixed',
  publisher: 'Yahoo Finance',
  link: 'https://finance.yahoo.com/news/market-today-123.html',
  publishedAt: '2026-10-16T12:00:00.000Z',
  symbol: 'TSLA',
  ...over
})

describe('canonicalArticleKey', () => {
  it('preserves case-sensitive paths and meaningful query values', () => {
    assert.notEqual(
      canonicalArticleKey(article({ link: 'https://example.com/Story?id=ABC' })),
      canonicalArticleKey(article({ link: 'https://example.com/story?id=abc' }))
    )
  })
  it('is stable across tracking-param and fragment variants', () => {
    const a = canonicalArticleKey(article())
    const b = canonicalArticleKey(article({ link: 'https://finance.yahoo.com/news/market-today-123.html?utm_source=x#top' }))
    assert.equal(a, b)
  })

  it('keeps genuinely distinct articles distinct', () => {
    assert.notEqual(
      canonicalArticleKey(article()),
      canonicalArticleKey(article({ link: 'https://finance.yahoo.com/news/other-456.html' }))
    )
  })

  it('falls back to title+publisher when no link exists', () => {
    const a = canonicalArticleKey(article({ link: '' }))
    const b = canonicalArticleKey(article({ link: '', symbol: 'NVDA' }))
    assert.equal(a, b)
    assert.notEqual(a, canonicalArticleKey(article({ link: '', title: 'Different headline' })))
  })
})

describe('dedupeNews', () => {
  it('collapses one article under three symbols, preserving all symbols', () => {
    const out = dedupeNews([
      article({ symbol: 'TSLA' }),
      article({ symbol: 'NVDA' }),
      article({ symbol: 'AAPL', publishedAt: '2026-10-16T13:00:00.000Z' })
    ])
    assert.equal(out.length, 1)
    assert.deepEqual(out[0].symbols, ['AAPL', 'NVDA', 'TSLA'])
    assert.equal(out[0].publishedAt, '2026-10-16T13:00:00.000Z')
  })

  it('keeps distinct articles separate and skips title-less rows', () => {
    const out = dedupeNews([
      article({ symbol: 'TSLA' }),
      article({ symbol: 'TSLA', title: 'Tesla unveils Roadster', link: 'https://x.test/roadster' }),
      { symbol: 'TSLA', publisher: 'No title here' }
    ])
    assert.equal(out.length, 2)
  })

  it('sorts newest first', () => {
    const out = dedupeNews([
      article({ publishedAt: '2026-10-15T10:00:00.000Z' }),
      article({ title: 'Newer', link: 'https://x.test/newer', publishedAt: '2026-10-16T10:00:00.000Z' })
    ])
    assert.equal(out[0].title, 'Newer')
  })
})
