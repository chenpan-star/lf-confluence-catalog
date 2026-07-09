import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AccessGate from './components/AccessGate';
import './index.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccessGate>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </AccessGate>
  </StrictMode>,
);
