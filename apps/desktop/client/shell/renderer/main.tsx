// Bundle the Material Symbols icon font locally instead of loading it from the
// Google Fonts CDN. The CDN fails on offline / firewalled devices (e.g. behind
// the GFW), which left icon ligatures showing as raw text ("chevron_right").
// Vite fingerprints and copies the woff2 into the build output.
import 'material-symbols/outlined.css';
import '@desktop-ui/shared/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@desktop-ui/app/App';
import { ErrorBoundary } from '@desktop-ui/shared/components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
