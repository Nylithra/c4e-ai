import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/pwaHelper';
import { installImageFallback } from './utils/imageFallback';
import { ErrorBoundary } from './components/ErrorBoundary';

registerServiceWorker();
// Broken or empty image URLs degrade into a designed placeholder instead of the
// browser's broken-image icon.
installImageFallback();

/**
 * The outermost boundary. React unmounts the whole tree when a render throws and nothing
 * catches it, which leaves a genuinely blank page — no navigation, no message, no way back.
 * App.tsx additionally wraps the active view, so in practice a failing screen is contained
 * there and this one only ever sees a failure in the shell itself.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      label="root"
      fallbackTitle="Uygulama Başlatılamadı"
      fallbackMessage="Code4Ever yüklenirken beklenmedik bir sorun oluştu. Sayfayı yenilemek çoğu durumda yeterlidir."
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
