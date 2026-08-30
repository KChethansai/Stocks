import { useEffect, useState } from 'react'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
export default function AccuracyPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { axios.get(`${API}/ml-api/accuracy`, { withCredentials: true }).then((r) => setData(r.data)).catch(() => setError('Accuracy data is unavailable right now.')) }, [])
  if (error) return <div className="rounded-2xl border border-[#F0656E]/30 bg-[#0F1724] p-6 text-sm text-[#F0656E]">{error}</div>
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-6 animate-pulse text-sm text-[#8B97A8]">Loading prediction accuracy…</div>
  if (data.insufficientData) return <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-6 text-sm text-[#8B97A8]">Not enough resolved predictions yet. Accuracy appears after 10 predictions are verified.</div>
  const bars = (data.calibration || []).filter((x) => x.total)
  return <div className="space-y-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[#8B97A8]">{data.demo ? 'Demo model trust' : 'Model trust'}</p><p className="mt-2 font-mono text-4xl text-[#E8EEF7]">{(data.accuracy * 100).toFixed(1)}%</p><p className="text-xs text-[#8B97A8]">{data.demo ? 'Simulated presentation metric · verified accuracy is shown when demo mode is disabled.' : `${data.correct} correct of ${data.total} resolved · ${data.streakType || 'no'} streak (${data.currentStreak || 0})`}</p></div><div><p className="mb-2 text-xs text-[#8B97A8]">Confidence bucket vs hit rate</p><div className="flex h-40 items-end gap-2">{bars.map((bucket) => <div key={bucket.bucket} className="flex h-full flex-1 flex-col justify-end"><div className="rounded-t bg-[#3B82F6]" style={{ height: `${Math.max(4, (bucket.hitRate || 0) * 100)}%` }} title={`${(bucket.hitRate * 100).toFixed(0)}% hit rate`} /><span className="mt-1 truncate text-center font-mono text-[9px] text-[#8B97A8]">{bucket.confidence}</span></div>)}</div></div><div className="space-y-2">{(data.predictions || []).slice(0, 8).map((p) => <div key={p._id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs"><span className="font-mono text-[#60A5FA]">{p.symbol}</span><span className="text-[#8B97A8]">{p.direction} → {p.actualDirection}</span><span className={p.wasCorrect ? 'text-[#2ECF8E]' : 'text-[#F0656E]'}>{p.wasCorrect ? 'Correct' : 'Incorrect'}</span></div>)}</div></div>
}
