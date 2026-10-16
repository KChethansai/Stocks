// Tracked stock universe (symbol, name, sector). Side-effect free: safe to
// import from the test-DB seed script without booting the API router.
// Exported for the isolated test-DB seed script (scripts/seedPwTest.js) so
// the seed covers the same universe without duplicating the list.
const baseStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', sector: 'Communication Services' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  { symbol: 'MA', name: 'Mastercard Incorporated', sector: 'Financial Services' },
  { symbol: 'HD', name: 'The Home Depot, Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'BAC', name: 'Bank of America Corp', sector: 'Financial Services' },
  { symbol: 'DIS', name: 'The Walt Disney Company', sector: 'Communication Services' },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce, Inc.', sector: 'Technology' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', sector: 'Consumer Defensive' },
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Defensive' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Semiconductors' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', sector: 'Healthcare' },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services' },
  { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services' }
]

export { baseStocks }

// Provider timestamp normalization (shared by the stock sync and the test
// seed). Yahoo delivers a Date object; defensively accept epoch seconds and
// epoch millis too (millis threshold matches the news path convention).
export function toProviderTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  // Only numbers and numeric strings are valid inputs. Booleans, objects,
  // and arrays coerce through Number() (true → 1) and must never become
  // valid-looking timestamps.
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n > 1e12 ? n : n * 1000)
}
