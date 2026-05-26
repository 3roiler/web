import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
// Sentry-Init MUSS vor dem ersten React-Render passieren — sonst
// fängt der ErrorBoundary keine Initial-Render-Errors mit. No-op
// wenn `VITE_SENTRY_DSN` leer ist (siehe lib/sentry.ts).
import { initSentry, Sentry } from "./lib/sentry";
initSentry();
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { KonamiEasterEgg } from "./components/KonamiEasterEgg";
import { ViewTransitions } from "./components/ViewTransitions";
import { HashScroll } from "./components/HashScroll";
import { HomePage } from "./pages/Home";
import { ImpressumPage } from "./pages/Impressum";
import { DatenschutzPage } from "./pages/Datenschutz";
import { GithubCallbackPage, TwitchCallbackPage, AuthErrorPage } from "./pages/Callbacks";
import { BlogPage } from "./pages/Blog";
import { BlogAdminPage } from "./pages/BlogAdmin";
import { DashboardHomePage } from "./pages/DashboardHome";
import { AdminUsersPage } from "./pages/AdminUsers";
import { AdminGroupsPage } from "./pages/AdminGroups";
import { AdminGroupDetailPage } from "./pages/AdminGroupDetail";
import { DashboardSettingsPage } from "./pages/DashboardSettings";
import { DashboardMetricsPage } from "./pages/DashboardMetrics";
import { ProfilePage } from "./pages/Profile";
import { PrintersPage } from "./pages/Printers";
import { PrinterNewPage } from "./pages/PrinterNew";
import { PrinterDetailPage } from "./pages/PrinterDetail";
import { PrinterJobsPage } from "./pages/PrinterJobs";
import { GcodePage } from "./pages/Gcode";
import { PrintRequestPage } from "./pages/PrintRequest";
import { PrintRequestsPage } from "./pages/PrintRequests";
import { PrintRequestDetailPage } from "./pages/PrintRequestDetail";
import { StreamclipsHomePage } from "./pages/streamclips/Landing";
import { VotePage } from "./pages/streamclips/Vote";
import { SubmitClipPage } from "./pages/streamclips/Submit";
import { LeaderboardPage } from "./pages/streamclips/Leaderboard";
import { StreamclipsContributorsPage } from "./pages/streamclips/Contributors";
import { ClipDetailPage } from "./pages/streamclips/ClipDetail";
import { MyClipsPage } from "./pages/streamclips/Me";
import { StreamerHubPage } from "./pages/streamclips/StreamerHub";
import { CategoryHubPage } from "./pages/streamclips/CategoryHub";
import { AwardHubPage } from "./pages/streamclips/AwardHub";
import { DashboardClipsPage } from "./pages/DashboardClips";
import { DashboardAwardsPage } from "./pages/DashboardAwards";
import { DashboardClipCategoriesPage } from "./pages/DashboardClipCategories";
import { DashboardClipSettingsPage } from "./pages/DashboardClipSettings";
import { DashboardReportsPage } from "./pages/DashboardReports";
import { DashboardMutesPage } from "./pages/DashboardMutes";
import { NotFoundPage } from "./pages/NotFound";
import { Routes } from "./config/routes";

/**
 * Route-level code splitting. Both the Markdown editor and the rendered-post
 * view depend on highlight.js (~400 KB), which we don't want to ship with the
 * homepage. The G-code editor in turn pulls in CodeMirror 6 (~110 KB gzip)
 * which is only useful to printer owners. Lazy-loading keeps the initial
 * bundle around ~70 kB gzip for everyone else.
 */
const BlogEditPage = React.lazy(() =>
  import("./pages/BlogEdit").then((m) => ({ default: m.BlogEditPage }))
);
const BlogPostPage = React.lazy(() =>
  import("./pages/BlogPost").then((m) => ({ default: m.BlogPostPage }))
);
const GcodeEditorPage = React.lazy(() =>
  import("./pages/GcodeEditor").then((m) => ({ default: m.GcodeEditorPage }))
);
// three.js (~150 kB gzip) is even bigger than CodeMirror — definitely
// keep it lazy so anyone who doesn't open the STL viewer never pays.
const StlPage = React.lazy(() => import("./pages/Stl").then((m) => ({ default: m.StlPage })));
const StlViewerPage = React.lazy(() =>
  import("./pages/StlViewer").then((m) => ({ default: m.StlViewerPage }))
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
      <KeyboardShortcuts />
      <KonamiEasterEgg />
      <ViewTransitions />
      <HashScroll />
      <React.Suspense fallback={<RouteFallback />}>
        <RouterRoutes>
          <Route path={Routes.Home} element={<HomePage />} />
          <Route path={Routes.Impressum} element={<ImpressumPage />} />
          <Route path={Routes.Datenschutz} element={<DatenschutzPage />} />
          <Route path={Routes.Blog} element={<BlogPage />} />
          <Route path={Routes.Profile} element={<ProfilePage />} />
          <Route path={Routes.PrintRequest} element={<PrintRequestPage />} />

          {/* Streamclips Germany — öffentlicher Bereich. */}
          <Route path={Routes.Streamclips.Home} element={<StreamclipsHomePage />} />
          <Route path={Routes.Streamclips.Vote} element={<VotePage />} />
          <Route path={Routes.Streamclips.Submit} element={<SubmitClipPage />} />
          <Route path={Routes.Streamclips.Leaderboard} element={<LeaderboardPage />} />
          <Route path={Routes.Streamclips.Contributors} element={<StreamclipsContributorsPage />} />
          <Route path={Routes.Streamclips.ClipDetail} element={<ClipDetailPage />} />
          <Route path={Routes.Streamclips.Me} element={<MyClipsPage />} />
          <Route path={Routes.Streamclips.StreamerHub} element={<StreamerHubPage />} />
          <Route path={Routes.Streamclips.CategoryHub} element={<CategoryHubPage />} />
          <Route path={Routes.Streamclips.AwardHub} element={<AwardHubPage />} />

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
          <Route path={Routes.Dashboard.PrintRequests} element={<PrintRequestsPage />} />
          <Route path={Routes.Dashboard.PrintRequestDetail} element={<PrintRequestDetailPage />} />
          {/* `/awards` und `/reports` MÜSSEN vor dem allgemeinen
              `/dashboard/clips` stehen bleiben — hier sind es eigene
              literale Pfade, daher unkritisch, aber der Klarheit halber
              gruppiert. */}
          <Route path={Routes.Dashboard.Clips} element={<DashboardClipsPage />} />
          <Route path={Routes.Dashboard.ClipsAwards} element={<DashboardAwardsPage />} />
          <Route
            path={Routes.Dashboard.ClipsCategories}
            element={<DashboardClipCategoriesPage />}
          />
          <Route path={Routes.Dashboard.ClipsSettings} element={<DashboardClipSettingsPage />} />
          <Route path={Routes.Dashboard.ClipsReports} element={<DashboardReportsPage />} />
          <Route path={Routes.Dashboard.ClipsMutes} element={<DashboardMutesPage />} />

          <Route path={Routes.BlogPost} element={<BlogPostPage />} />
          <Route path={Routes.Callback.Github} element={<GithubCallbackPage />} />
          <Route path={Routes.Callback.Twitch} element={<TwitchCallbackPage />} />
          <Route path={Routes.Callback.Error} element={<AuthErrorPage />} />

          {/* Catch-all → 404 (noindex). MUSS zuletzt stehen. */}
          <Route path="*" element={<NotFoundPage />} />
        </RouterRoutes>
      </React.Suspense>
      <Footer />
    </BrowserRouter>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element in index.html");
}
// `Sentry.ErrorBoundary` fängt jeden Render-Error in der Komponenten-
// Tree, schickt ihn an Sentry und zeigt einen schlanken Fallback. Bei
// fehlendem DSN ist das ein normaler React-ErrorBoundary ohne Side-
// Effects — wir wrappen unbedingt, damit kein Whitescreen entsteht.
createRoot(rootEl).render(
  <Sentry.ErrorBoundary
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-slate-100">Etwas ist schiefgelaufen</h1>
          <p className="mt-3 text-sm text-slate-400">
            Die Seite konnte nicht geladen werden. Wir haben den Fehler erhalten und schauen ihn uns
            an.
          </p>
          <a href="/" className="btn-outline mt-6 inline-block">
            Zur Startseite
          </a>
        </div>
      </div>
    }
  >
    <AppRoot />
  </Sentry.ErrorBoundary>
);
