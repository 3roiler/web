import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/Home';
import { ImpressumPage } from './pages/Impressum';
import { DatenschutzPage } from './pages/Datenschutz';
import { GithubCallbackPage, AuthErrorPage } from './pages/Callbacks';
import { BlogPage } from './pages/Blog';
import { BlogAdminPage } from './pages/BlogAdmin';
import { DashboardHomePage } from './pages/DashboardHome';
import { AdminUsersPage } from './pages/AdminUsers';
import { AdminGroupsPage } from './pages/AdminGroups';
import { AdminGroupDetailPage } from './pages/AdminGroupDetail';
import { ProfilePage } from './pages/Profile';
import { Routes } from './config/routes';

/**
 * Route-level code splitting. Both the Markdown editor and the rendered-post
 * view depend on highlight.js (~400 KB), which we don't want to ship with the
 * homepage. Lazy-loading here keeps the initial bundle around ~70 kB gzip.
 */
const BlogEditPage = React.lazy(() =>
  import('./pages/BlogEdit').then((m) => ({ default: m.BlogEditPage }))
);
const BlogPostPage = React.lazy(() =>
  import('./pages/BlogPost').then((m) => ({ default: m.BlogPostPage }))
);

function RouteFallback() {
  return (
    <main className="min-h-screen bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
        Lade…
      </div>
    </main>
  );
}

function AppRoot() {
  return (
    <BrowserRouter>
      <Header />
      <React.Suspense fallback={<RouteFallback />}>
        <RouterRoutes>
          <Route path={Routes.Home} element={<HomePage />} />
          <Route path={Routes.Impressum} element={<ImpressumPage />} />
          <Route path={Routes.Datenschutz} element={<DatenschutzPage />} />
          <Route path={Routes.Blog} element={<BlogPage />} />
          <Route path={Routes.Profile} element={<ProfilePage />} />

          {/* Dashboard: zentrale Verwaltung. Alle Berechtigungsprüfungen
              laufen sowohl im DashboardLayout (UX) als auch im API-Handler. */}
          <Route path={Routes.Dashboard.Home} element={<DashboardHomePage />} />
          <Route path={Routes.Dashboard.Blog} element={<BlogAdminPage />} />
          <Route path={Routes.Dashboard.BlogNew} element={<BlogEditPage />} />
          <Route path={Routes.Dashboard.BlogEdit} element={<BlogEditPage />} />
          <Route path={Routes.Dashboard.Users} element={<AdminUsersPage />} />
          <Route path={Routes.Dashboard.Groups} element={<AdminGroupsPage />} />
          <Route path={Routes.Dashboard.GroupDetail} element={<AdminGroupDetailPage />} />

          <Route path={Routes.BlogPost} element={<BlogPostPage />} />
          <Route path={Routes.Callback.Github} element={<GithubCallbackPage />} />
          <Route path={Routes.Callback.Error} element={<AuthErrorPage />} />
        </RouterRoutes>
      </React.Suspense>
      <Footer />
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}
createRoot(rootEl).render(<AppRoot />);
