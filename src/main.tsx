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
import { DashboardSettingsPage } from './pages/DashboardSettings';
import { DashboardMetricsPage } from './pages/DashboardMetrics';
import { ProfilePage } from './pages/Profile';
import { PrintersPage } from './pages/Printers';
import { PrinterNewPage } from './pages/PrinterNew';
import { PrinterDetailPage } from './pages/PrinterDetail';
import { PrinterJobsPage } from './pages/PrinterJobs';
import { GcodePage } from './pages/Gcode';
import { Routes } from './config/routes';

/**
 * Route-level code splitting. Both the Markdown editor and the rendered-post
 * view depend on highlight.js (~400 KB), which we don't want to ship with the
 * homepage. The G-code editor in turn pulls in CodeMirror 6 (~110 KB gzip)
 * which is only useful to printer owners. Lazy-loading keeps the initial
 * bundle around ~70 kB gzip for everyone else.
 */
const BlogEditPage = React.lazy(() =>
  import('./pages/BlogEdit').then((m) => ({ default: m.BlogEditPage }))
);
const BlogPostPage = React.lazy(() =>
  import('./pages/BlogPost').then((m) => ({ default: m.BlogPostPage }))
);
const GcodeEditorPage = React.lazy(() =>
  import('./pages/GcodeEditor').then((m) => ({ default: m.GcodeEditorPage }))
);
// three.js (~150 kB gzip) is even bigger than CodeMirror — definitely
// keep it lazy so anyone who doesn't open the STL viewer never pays.
const StlPage = React.lazy(() =>
  import('./pages/Stl').then((m) => ({ default: m.StlPage }))
);
const StlViewerPage = React.lazy(() =>
  import('./pages/StlViewer').then((m) => ({ default: m.StlViewerPage }))
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
          <Route path={Routes.Dashboard.Settings} element={<DashboardSettingsPage />} />
          <Route path={Routes.Dashboard.Metrics} element={<DashboardMetricsPage />} />
          <Route path={Routes.Dashboard.Printers} element={<PrintersPage />} />
          <Route path={Routes.Dashboard.PrinterNew} element={<PrinterNewPage />} />
          <Route path={Routes.Dashboard.PrinterDetail} element={<PrinterDetailPage />} />
          <Route path={Routes.Dashboard.PrinterJobs} element={<PrinterJobsPage />} />
          <Route path={Routes.Dashboard.Gcode} element={<GcodePage />} />
          {/* `/new` MUST come before `/:id/edit` so the literal segment
              wins over the param. React-Router 7 actually rank-orders
              routes, but keeping the obvious ordering avoids surprises. */}
          <Route path={Routes.Dashboard.GcodeNew} element={<GcodeEditorPage />} />
          <Route path={Routes.Dashboard.GcodeEdit} element={<GcodeEditorPage />} />
          <Route path={Routes.Dashboard.Stl} element={<StlPage />} />
          <Route path={Routes.Dashboard.StlViewer} element={<StlViewerPage />} />

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
