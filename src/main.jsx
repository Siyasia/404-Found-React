import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './App.css';
import { UserProvider } from './UserContext.jsx';
import { AppThemeProvider } from './styles/AppThemeProvider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <UserProvider>
        <AppThemeProvider>
          <App />
        </AppThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
