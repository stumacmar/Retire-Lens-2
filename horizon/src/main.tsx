import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// The Lantern preview (docs/LANTERN_PLAN.md, Stage 1) opens at ?lantern=1 and
// loads Three.js in its own chunk, so the app itself carries none of it.
const lantern = new URLSearchParams(window.location.search).has('lantern');
const LanternPreview = lazy(() => import('./lantern/LanternPreview'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {lantern ? <Suspense fallback={null}><LanternPreview /></Suspense> : <App />}
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
