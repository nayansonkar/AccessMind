import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely detect web preview mode in external module script to comply with MV3 CSP
const chromeObj = typeof window !== 'undefined' ? (window as any).chrome : undefined;
if (!chromeObj || !chromeObj.runtime || !chromeObj.runtime.id) {
  document.documentElement.classList.add('web-preview');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

