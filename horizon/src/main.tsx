import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// The Lantern preview (docs/LANTERN_PLAN.md, Stage 1) opens at ?lantern=1 and
// loads Three.js in its own chunk, so the app itself carries none of it.
const lantern = new URLSearchParams(window.location.search).has('lantern');
const LanternPreview = lazy(() => import('./lantern/LanternPreview'));
// The lab (docs/agents/PENSION_SCOUT.md §3.3): concepts for the home on the real engine at ?lab=<name>.
// Reached only by its address, never linked from the app, in its own chunk.
const lab = new URLSearchParams(window.location.search).has('lab');
const Lab = lazy(() => import('./lab/Lab'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {lab ? <Suspense fallback={null}><Lab /></Suspense> : lantern ? <Suspense fallback={null}><LanternPreview /></Suspense> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);

// Offline excellence: a conservative service worker (network-first shell,
// stale-while-revalidate assets). Registration failure is harmless.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* e.g. private mode */ });
  });
}
