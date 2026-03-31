/**
 * Kitchen Display System — Entry Point
 *
 * Renders the main App component to the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/kanban.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
