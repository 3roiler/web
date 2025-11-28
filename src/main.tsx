import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/Home.js';
import { ImpressumPage } from './pages/Impressum.js';
import { DatenschutzPage } from './pages/Datenschutz.js';
import { authenticateGithub } from './services/index.js';
import { AuthErrorPage } from './pages/AuthError.js';

function AppRoot() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />}  />
        <Route path="/impressum" element={<ImpressumPage />}  />
        <Route path="/datenschutz" element={<DatenschutzPage />} />
        <Route path="/callback/github" element={<GithubCallbackPage />}  />
        <Route path="/auth/error" element={<AuthErrorPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

function GithubCallbackPage() {

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      authenticateGithub(code, state).then(user => {
          localStorage.setItem('user', JSON.stringify(user));
          window.location.href = "/";
        }).catch(() => {
          window.location.href = "/auth/error";
        });
    } else {
      window.location.href = "/auth/error";
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
      <p>Authentifizierung läuft...</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<AppRoot />);
