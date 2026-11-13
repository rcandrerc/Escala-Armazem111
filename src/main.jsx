import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Escala from './Escala';
import './estilo.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Escala />
  </StrictMode>,
);
