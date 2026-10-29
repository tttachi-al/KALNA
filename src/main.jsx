import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fuentes incluidas en el proyecto (funcionan sin conexión)
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/600.css';
import '@fontsource/lexend/700.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/source-sans-3/wght-italic.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/print.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
