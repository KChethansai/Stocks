// News attribution: the defect class these pin is a headline about one company
// rendered under another company's ticker.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalArticleKey,
  duplicateFingerprint,
  attributeArticle,
  normalizeArticle,
  mergeArticles
} from '../services/newsAttribution.js'

// A counter makes every fixture's default title distinct. Without it, several
// tests would share a title+publisher fingerprint and the merge's duplicate
// collapsing would (correctly) fuse rows the test meant to keep apart.
let seq = 0
const RAW = (over = {}) => ({
  title: `Headline ${++seq}`,
  publisher: 'Motley Fool',
  link: `https://example.com/a/story-${seq}`,
  providerPublishTime: 1792180801,
  ...over
})

describe('attributeArticle', () => {
  it('uses only the provider associations, never the retrieval query', () => {
    // Real shape observed from Yahoo: an ETF piece reached by the NVDA query
    // carries ["NVDA"], an Opendoor piece carries ["OPEN","^IXIC","Z","^GSPC"].
    const a = attributeArticle(['NVDA'])
    assert.deepEqual(a.symbols, ['NVDA'])
    assert.deepEqual(a.indices, [])
  })

  it('keeps only universe equities as tradeable tickers', () => {
    const { symbols } = attributeArticle(['AAPL', 'ZZZZ', 'TSLA'])
    assert.deepEqual(symbols, ['AAPL', 'TSLA'], 'a ticker outside the universe is omitted, not rendered bare')
  })

  it('labels provider-attached indexes instead of showing raw index symbols', () => {
    const { symbols, indices } = attributeArticle(['^GSPC', '^IXIC', '^DJI', 'AAPL'])
    assert.deepEqual(symbols, ['AAPL'])
    assert.deepEqual(indices, ['Dow Jones', 'Nasdaq', 'S&P 500'])
  })

  it('attributes nothing when the provider named nothing', () => {
    for (const input of [undefined, null, [], ['', '   ']]) {
      const { symbols, indices } = attributeArticle(input)
      assert.equal(symbols.length, 0)
      assert.equal(indices.length, 0)
    }
  })

  it('deduplicates repeated associations', () => {
    const { symbols } = attributeArticle(['AAPL', 'aapl', 'AAPL'])
    assert.deepEqual(symbols, ['AAPL'])
  })
})

describe('normalizeArticle', () => {
  it('never copies the queried symbol onto an unrelated article', () => {
    const a = normalizeArticle(RAW({ relatedTickers: ['KO'] }))
    assert.deepEqual(a.symbols, ['KO'])
    assert.notEqual(a.symbols.includes('NVDA'), true)
  })

  it('marks an article with no provider association as unattributed', () => {
    assert.equal(normalizeArticle(RAW({ relatedTickers: [] })).unattributed, true)
    assert.equal(normalizeArticle(RAW({ relatedTickers: ['AAPL'] })).unattributed, false)
    assert.equal(normalizeArticle(RAW({ relatedTickers: ['^GSPC'] })).unattributed, false)
  })

  it('keeps publication time separate from fetch time', () => {
    const a = normalizeArticle(RAW({ providerPublishTime: 1792180801 }), { fetchedAt: '2026-10-20T00:00:00.000Z' })
    assert.equal(a.publishedAt, '2026-10-16T20:00:01.000Z')
    assert.equal(a.fetchedAt, '2026-10-20T00:00:00.000Z')
    assert.notEqual(a.publishedAt, a.fetchedAt)
  })

  it('accepts provider timestamps in seconds and milliseconds alike', () => {
    assert.equal(normalizeArticle(RAW({ providerPublishTime: 1792180801 })).publishedAt, '2026-10-16T20:00:01.000Z')
    assert.equal(normalizeArticle(RAW({ providerPublishTime: 1792180801000 })).publishedAt, '2026-10-16T20:00:01.000Z')
  })

  it('preserves publisher, url and summary from the provider', () => {
    const raw = RAW({
      link: 'https://finance.yahoo.com/news/story.html',
      summary: 'A summary',
      thumbnail: { resolutions: [{ size: 'large', url: 'https://img/l.jpg' }] }
    })
    const a = normalizeArticle(raw)
    assert.equal(a.publisher, raw.publisher)
    assert.equal(a.link, raw.link)
    assert.equal(a.summary, 'A summary')
    assert.equal(a.thumbnail, 'https://img/l.jpg')
  })

  it('drops a titleless article rather than rendering a blank row', () => {
    assert.equal(normalizeArticle(RAW({ title: '' })), null)
    assert.equal(normalizeArticle(RAW({ title: '   ' })), null)
  })
})

describe('canonicalArticleKey', () => {
  it('ignores tracking parameters and fragments', () => {
    assert.equal(
      canonicalArticleKey({ link: 'https://Example.com/a/b/?utm_source=x#frag' }),
      canonicalArticleKey({ link: 'https://example.com/a/b' })
    )
  })
})

describe('mergeArticles', () => {
  it('deduplicates the same article while preserving both symbol associations', () => {
    // The SAME article as the provider returned it from two feeds: identical
    // URL apart from a tracking parameter.
    const url = 'https://example.com/a/story'
    const merged = mergeArticles([
      [RAW({ link: url, relatedTickers: ['AAPL'] })],
      [RAW({ link: `${url}?utm_campaign=y`, relatedTickers: ['TSLA'] })]
    ])
    assert.equal(merged.length, 1, 'same canonical URL is one article')
    assert.deepEqual(merged[0].symbols, ['AAPL', 'TSLA'], 'both real associations survive')
  })

  it('never invents an association for an article nobody attributed', () => {
    const merged = mergeArticles([[RAW({ relatedTickers: [] })], [RAW({ link: 'https://other.com/b', relatedTickers: [] })]])
    assert.equal(merged.length, 2)
    for (const a of merged) {
      assert.equal(a.unattributed, true)
      assert.equal(a.symbols.length, 0)
    }
  })

  it('sorts newest first and puts undated articles last', () => {
    const merged = mergeArticles([
      [RAW({ link: 'https://e.com/old', providerPublishTime: 1792157400 })],
      [RAW({ link: 'https://e.com/new', providerPublishTime: 1792180801 })],
      [RAW({ link: 'https://e.com/none', providerPublishTime: 0 })]
    ])
    assert.deepEqual(merged.map((a) => a.link), ['https://e.com/new', 'https://e.com/old', 'https://e.com/none'])
  })

  it('keeps the newest publication time and fills a missing thumbnail', () => {
    // Realistic epoch seconds, so the s/ms discriminator is exercised on real
    // magnitudes rather than toy values.
    const merged = mergeArticles([
      [RAW({ providerPublishTime: 1792157400 })],
      [RAW({ providerPublishTime: 1792180801, thumbnail: { resolutions: [{ size: 'large', url: 'https://img/l.jpg' }] } })]
    ])
    assert.equal(merged[0].publishedAt, '2026-10-16T20:00:01.000Z')
    assert.equal(merged[0].thumbnail, 'https://img/l.jpg')
  })
})

// Reproduced verbatim from the live provider (Oct 2026): the same syndicated
// PR Newswire release published twice, under two slugs, with two different
// `uuid`s and two different publication times. URL and uuid both fail to
// identify these as one article, so the feed showed the headline twice.
describe('syndicated duplicates the provider does not identify', () => {
  const shared = {
    title: 'Crisis - Building a Tourism Economy for a Shared Future',
    publisher: 'PR Newswire'
  }
  const A = RAW({
    ...shared,
    link: 'https://finance.yahoo.com/economy/articles/crisis-tourism-004500627.html',
    providerPublishTime: 1792295100, // 03:45 UTC
    uuid: '79f26833-91f9-37dd-a328-910eddb9eb0b'
  })
  const B = RAW({
    ...shared,
    link: 'https://finance.yahoo.com/economy/articles/crisis-tourism-004000022.html',
    providerPublishTime: 1792294800, // 03:40 UTC
    uuid: '759ce9d2-f163-3093-9c65-7655a7e59326'
  })

  it('collapses them even though url and uuid both differ', () => {
    assert.notEqual(canonicalArticleKey(A), canonicalArticleKey(B), 'the URL key cannot catch this')
    assert.notEqual(A.uuid, B.uuid, 'the provider uuid cannot catch this either')
    assert.equal(duplicateFingerprint(A), duplicateFingerprint(B), 'title+publisher can')
  })

  it('renders one row, pointing at the freshest copy', () => {
    const merged = mergeArticles([[A, B]])
    assert.equal(merged.length, 1, 'the same release must not appear twice')
    assert.equal(merged[0].duplicateCount, 1, 'but the collapse is recorded, not hidden')
    assert.equal(merged[0].sources, 2)
    assert.equal(merged[0].link, A.link, 'links to the newer copy')
    assert.equal(merged[0].publishedAt, '2026-10-18T03:45:00.000Z', 'keeps the newer of the two stamps')
  })

  it('still keeps both symbol associations when the two copies name different ones', () => {
    const merged = mergeArticles([
      [RAW({ ...A, relatedTickers: ['AAPL'] })],
      [RAW({ ...B, relatedTickers: ['KO'] })]
    ])
    assert.equal(merged.length, 1)
    assert.deepEqual(merged[0].symbols, ['AAPL', 'KO'])
  })

  it('does not collapse two different headlines that merely share a publisher', () => {
    const merged = mergeArticles([
      [RAW({ title: 'One story', publisher: 'Reuters' })],
      [RAW({ title: 'A different story', publisher: 'Reuters' })]
    ])
    assert.equal(merged.length, 2)
  })

  it('does not collapse the same headline published far apart', () => {
    // A publisher can run the same headline twice. Without the 24h window this
    // would silently fuse two genuinely separate stories.
    const older = RAW({ ...shared, link: 'https://e.com/x', providerPublishTime: 1792294800 })
    const muchLater = RAW({ ...shared, link: 'https://e.com/y', providerPublishTime: 1792294800 + 40 * 86400000 })
    const merged = mergeArticles([[older, muchLater]])
    assert.equal(merged.length, 2, '40 days apart is two stories, not one syndicated release')
  })
})

// Two bugs an independent review caught in the duplicate-collapse guard.
describe('fingerprint collapse guards', () => {
  it('does not collapse two undated same-headline articles', () => {
    // `new Date(null)` and `new Date(0)` both yield 0, which IS finite, so the
    // original `Number.isFinite` guard could never fire and these collapsed on
    // title alone.
    const shared = { title: 'Same headline', publisher: 'Some Wire' }
    const merged = mergeArticles([
      [RAW({ ...shared, link: 'https://e.com/a', providerPublishTime: 0 })],
      [RAW({ ...shared, link: 'https://e.com/b', providerPublishTime: null })]
    ])
    assert.equal(merged.length, 2, 'undated rows cannot be shown to be the same story')
  })

  it('still collapses dated near-identical entries', () => {
    const shared = { title: 'Same headline', publisher: 'Some Wire' }
    const merged = mergeArticles([
      [RAW({ ...shared, link: 'https://e.com/a', providerPublishTime: 1792295100 })],
      [RAW({ ...shared, link: 'https://e.com/b', providerPublishTime: 1792294800 })]
    ])
    assert.equal(merged.length, 1)
  })
})
