import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppFrame from './components/ui/AppFrame';
import { installViewportVars } from './utils/viewport';
import './styles/index.css';

// Fuera de React: StrictMode no la duplica. Vive toda la sesión (sin cleanup).
installViewportVars();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppFrame>
      <App />
    </AppFrame>
  </React.StrictMode>
);
