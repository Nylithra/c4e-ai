import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/pwaHelper';
import { installImageFallback } from './utils/imageFallback';

registerServiceWorker();
// Broken or empty image URLs degrade into a designed placeholder instead of the
// browser's broken-image icon.
installImageFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

