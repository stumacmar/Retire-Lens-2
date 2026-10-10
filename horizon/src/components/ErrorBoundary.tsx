import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * A calm landing if anything ever throws: no white screen, nothing sent
 * anywhere. Offers a reload, a way back to the welcome screen, and the
 * details to copy into an email — the diagnostics stay with the person.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; info: string }> {
  state = { error: null as Error | null, info: '' };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { this.setState({ info: info.componentStack || '' }); }
  render() {
    if (!this.state.error) return this.props.children;
    const details = `Someday ${new Date().toISOString()}\n${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ''}\n${this.state.info}`;
    const startOver = () => { try { localStorage.removeItem('horizon-plan-v1'); } catch { /* ignore */ } location.reload(); };
    return (
      <div className="min-h-full flex items-center justify-center px-6" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
        <div className="w-full max-w-[420px]">
          <div className="text-[0.74rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-hope)' }}>Something went wrong</div>
          <h1 className="mt-2 text-[1.6rem] font-extrabold tracking-tight leading-tight">The page hit a snag.</h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
            Your figures are still saved on this device. Reloading usually fixes it. If it keeps happening, copy the details
            and email them to us — they contain the error, not your numbers.
          </p>
          <button onClick={() => location.reload()} className="mt-5 w-full rounded-2xl py-3.5 font-bold text-white" style={{ background: 'var(--color-calm)' }}>Reload</button>
          <button onClick={() => { navigator.clipboard?.writeText(details).catch(() => {}); }} className="mt-2 w-full rounded-2xl py-3 font-semibold"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>Copy the details</button>
          <button onClick={startOver} className="mt-2 w-full rounded-2xl py-3 font-semibold" style={{ color: 'var(--color-hope)' }}>Start over (clears the plan on this device)</button>
          <pre className="mt-4 text-[0.68rem] leading-snug whitespace-pre-wrap break-words rounded-2xl p-3" style={{ background: 'var(--color-surface)', color: 'var(--color-ink-faint)', maxHeight: 160, overflow: 'auto' }}>{details}</pre>
        </div>
      </div>
    );
  }
}
