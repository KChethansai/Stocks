import { useEffect, useState } from 'react'
import axios from 'axios'
import Reveal from '../ui/Reveal'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

function PanelShell({ children }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111318] p-6 text-sm shadow-xl">
      {children}
    </div>
  )
}

export default function AccuracyPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { axios.get(`${API}/ml-api/accuracy`, { withCredentials: true }).then((r) => setData(r.data)).catch(() => setError('Accuracy data is unavailable right now.')) }, [])
  if (error) return <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8"><PanelShell><span className="text-[#EF4444]">{error}</span></PanelShell></div>
  if (!data) return <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8"><PanelShell><span className="animate-pulse text-xs text-[#9CA3AF]">Loading prediction accuracy…</span></PanelShell></div>
  if (data.insufficientData) return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <Reveal className="pb-2">
        <p className="mf-eyebrow mb-3">Model trust</p>
        <h1 className="mf-h1">Prediction Accuracy</h1>
        <p className="mt-1 text-xs text-[#9CA3AF] sm:text-sm">Verified hit rates across confidence buckets.</p>
      </Reveal>
      <Reveal delay={0.05}>
        <PanelShell><span className="text-xs text-[#9CA3AF]">Not enough resolved predictions yet. Accuracy appears after 10 predictions are verified.</span></PanelShell>
      </Reveal>
    </div>
  )
  const bars = (data.calibration || []).filter((x) => x.total)
  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <Reveal className="pb-2">
        <p className="mf-eyebrow mb-3">Model trust</p>
        <h1 className="mf-h1">Prediction Accuracy</h1>
        <p className="mt-1 text-xs text-[#9CA3AF] sm:text-sm">Verified hit rates across confidence buckets.</p>
      </Reveal>
      <Reveal delay={0.05}>
        <div className="space-y-6 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111318] p-5 shadow-xl"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[#9CA3AF]">{data.demo ? 'Demo model trust' : 'Model trust'}</p><p className="mt-2 font-mono text-4xl text-[#F5F7FA]">{(data.accuracy * 100).toFixed(1)}%</p><p className="text-xs text-[#9CA3AF]">{data.demo ? 'Simulated presentation metric · verified accuracy is shown when demo mode is disabled.' : `${data.correct} correct of ${data.total} resolved · ${data.streakType || 'no'} streak (${data.currentStreak || 0})`}</p></div><div><p className="mb-2 text-xs text-[#9CA3AF]">Confidence bucket vs hit rate</p><div className="flex h-40 items-end gap-2">{bars.map((bucket) => <div key={bucket.bucket} className="flex h-full flex-1 flex-col justify-end"><div className="rounded-t bg-[#3B82F6]" style={{ height: `${Math.max(4, (bucket.hitRate || 0) * 100)}%` }} title={`${(bucket.hitRate * 100).toFixed(0)}% hit rate`} /><span className="mt-1 truncate text-center font-mono text-[9px] text-[#9CA3AF]">{bucket.confidence}</span></div>)}</div></div><div className="space-y-2">{(data.predictions || []).slice(0, 8).map((p) => <div key={p._id} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs"><span className="font-mono text-[#3B82F6]">{p.symbol}</span><span className="text-[#9CA3AF]">{p.direction} → {p.actualDirection}</span><span className={p.wasCorrect ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{p.wasCorrect ? 'Correct' : 'Incorrect'}</span></div>)}</div></div>
      </Reveal>
    </div>
  )
}
