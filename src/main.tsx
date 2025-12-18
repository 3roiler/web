import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router-dom';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/Home.js';
import { ImpressumPage } from './pages/Impressum.js';
import { DatenschutzPage } from './pages/Datenschutz.js';
import { GithubCallbackPage, AuthErrorPage } from './pages/Callbacks.js';
import { Routes } from './config/routes.js';

function AppRoot() {
  return (
    <BrowserRouter>
      <Header />
      <RouterRoutes>
        <Route path={Routes.Home} element={<HomePage />}  />
        <Route path={Routes.Impressum} element={<ImpressumPage />}  />
        <Route path={Routes.Datenschutz} element={<DatenschutzPage />} />
        <Route path={Routes.Callback.Github} element={<GithubCallbackPage />}  />
        <Route path={Routes.Callback.Error} element={<AuthErrorPage />} />
      </RouterRoutes>
      <Footer />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<AppRoot />);