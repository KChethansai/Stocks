// LOCAL GLUE (not Bklit source): minimal re-implementation of Bklit's
// unpublished ./decimate-time-series, derived from call sites in
// candlestick-chart.tsx and time-series-chart-shell.tsx.
export function maxRenderPointsForWidth(width) {
  if (!width || width < 10) return 60;
  return Math.max(24, Math.floor(width / 2));
}

function bucketize(data, maxPoints, merge) {
  if (!Array.isArray(data) || data.length <= maxPoints || maxPoints < 2) return data;
  const out = [];
  const size = Math.ceil(data.length / maxPoints);
  for (let i = 0; i < data.length; i += size) {
    const bucket = data.slice(i, i + size);
    out.push(bucket.length === 1 ? bucket[0] : merge(bucket));
  }
  return out;
}

export function decimateOhlcData(data, maxPoints) {
  return bucketize(data, maxPoints, (bucket) => ({
    ...bucket[bucket.length - 1],
    open: bucket[0].open,
    high: Math.max(...bucket.map((d) => d.high)),
    low: Math.min(...bucket.map((d) => d.low)),
    close: bucket[bucket.length - 1].close,
  }));
}

export function decimateTimeSeries(data, maxPoints) {
  return bucketize(data, maxPoints, (bucket) => bucket[bucket.length - 1]);
}
