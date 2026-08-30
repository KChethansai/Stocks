import React, { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Logo3D from './Logo3D'
import { Button } from './ui/Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('MarketForge caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center text-[#F5F7FA]">
          <div className="w-full max-w-md bg-[#111318] border border-white/15 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex justify-center">
              <Logo3D size="lg" withGlow={true} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-[#EF4444]">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="text-lg font-bold font-mono">Workspace Interrupted</h2>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                An unexpected interface anomaly was caught. You can restore your trading workspace below.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={this.handleReset}
              className="w-full py-3 rounded-xl shadow-lg shadow-[#3B82F6]/25"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload MarketForge</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
