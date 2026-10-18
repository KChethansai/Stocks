// Server-side pagination for the activity ledger.
//
// Why this is not just "page the latest 100 in the browser": the old route
// fetched the newest 100 rows and returned them whole. Slicing that array into
// pages would make page 14 of a 136-record ledger render nothing while the UI
// claimed to represent the whole history. Filters, totals and ordering all have
// to be decided by the database, over the FULL collection, or the page numbers
// lie.
//
// Ownership is enforced on BOTH the records and the totals: every filter is
// rooted at `userId: req.user.id`, so `countDocuments` can only ever count the
// caller's own rows. There is no path here that reads another user's history.
//
// Ordering is `createdAt desc, _id desc`. Several fills can land in the same
// millisecond; without the `_id` tie-breaker MongoDB returns tied rows in an
// unspecified order that can differ per page, which duplicates one row and
// drops another across a page boundary.
import { transactionModel } from '../models/TransactionModel.js'

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50
// Hard safety ceiling for the CSV "all matching records" export. A response is
// never silently truncated: the caller is told whether `truncated` is set.
export const EXPORT_MAX_ROWS = 10000

const SIDES = new Set(['BUY', 'SELL'])

/** Parse and bound the page-size. Out-of-range or junk input falls back to the default. */
export function parsePageSize(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.floor(n))
}

/** Parse the 1-based page. Anything below 1 is clamped to the first page. */
export function parsePage(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

/** Parse the side filter. Only BUY/SELL filter; anything else means "all". */
export function parseSide(raw) {
  const s = String(raw || '').trim().toUpperCase()
  return SIDES.has(s) ? s : null
}

/**
 * Build the query for the caller's transactions.
 *
 * The search term matches symbol or side, and is applied BEFORE pagination so
 * "Showing 11-20 of 34" describes the filtered set. Escaping matters: the term
 * is user input going into a RegExp, and an unescaped `(` would otherwise throw
 * and 500 the ledger.
 */
export function buildLedgerQuery({ userId, side, q }) {
  const query = { userId }
  if (side) query.type = side
  const term = String(q || '').trim()
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 64)
    // Anchored prefix on symbol, substring on side, both case-insensitive.
    query.$or = [
      { symbol: { $regex: new RegExp(`^${safe}`, 'i') } },
      { type: { $regex: new RegExp(safe, 'i') } }
    ]
  }
  return query
}

/** Account-wide side counts, independent of the current filter and page. */
export async function accountSideCounts(userId) {
  const [buys, sells, total] = await Promise.all([
    transactionModel.countDocuments({ userId, type: 'BUY' }),
    transactionModel.countDocuments({ userId, type: 'SELL' }),
    transactionModel.countDocuments({ userId })
  ])
  return { buys, sells, total }
}

/**
 * One page of the caller's ledger, plus the counts the UI needs to describe it
 * honestly. `clamped` reports that the requested page was past the end and the
 * caller was moved to the last real page, so the UI can say so rather than
 * showing an empty page as if it were the end of the data.
 */
export async function fetchLedgerPage({ userId, page, pageSize, side, q }) {
  const query = buildLedgerQuery({ userId, side, q })

  const total = await transactionModel.countDocuments(query)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Clamp BEFORE the skip query, not after. `?page=1000000000` otherwise makes
  // MongoDB walk ~1e10 index entries before returning nothing — the old code
  // only clamped the page number after the expensive read had already run.
  // `total` is needed for the clamp, and it is one indexed count.
  const clamped = page > totalPages && total > 0
  const effectivePage = clamped ? totalPages : page

  const records = await transactionModel
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip((effectivePage - 1) * pageSize)
    .limit(pageSize)
    .lean()

  // An empty collection has one (empty) page; page 1 of it is valid and empty.
  const finalPage = total === 0 ? 1 : effectivePage

  const from = total === 0 ? 0 : (finalPage - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(total, from + records.length - 1)

  return {
    transactions: records,
    page: finalPage,
    pageSize,
    total,
    totalPages,
    from,
    to,
    clamped,
    hasPrev: finalPage > 1,
    hasNext: finalPage < totalPages,
    side: side || null
  }
}

/** Every record matching the current filter, for the explicit CSV export scope. */
export async function fetchLedgerForExport({ userId, side, q }) {
  const query = buildLedgerQuery({ userId, side, q })
  const total = await transactionModel.countDocuments(query)
  const rows = await transactionModel
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(EXPORT_MAX_ROWS)
    .lean()
  return { rows, total, truncated: total > rows.length, cap: EXPORT_MAX_ROWS }
}