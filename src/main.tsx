import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/Home';
import { ImpressumPage } from './pages/Impressum';
import { DatenschutzPage } from './pages/Datenschutz';
import { GithubCallbackPage, AuthErrorPage } from './pages/Callbacks';
import { Routes } from './config/routes';

function AppRoot() {
  return (
    <BrowserRouter>
      <Header />
      <RouterRoutes>
        <Route path={Routes.Home} element={<HomePage />} />
        <Route path={Routes.Impressum} element={<ImpressumPage />} />
        <Route path={Routes.Datenschutz} element={<DatenschutzPage />} />
        <Route path={Routes.Callback.Github} element={<GithubCallbackPage />} />
        <Route path={Routes.Callback.Error} element={<AuthErrorPage />} />
      </RouterRoutes>
      <Footer />
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}
createRoot(rootEl).render(<AppRoot />);
