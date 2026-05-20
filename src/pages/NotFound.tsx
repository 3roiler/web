import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { Routes } from "../config/routes";

/**
 * SPA-Catch-all. Da Caddy für unbekannte Pfade die index.html mit Status 200
 * ausliefert (Soft-404), markieren wir solche Seiten wenigstens als
 * `noindex`, damit Google keine Müll-URLs in den Index nimmt.
 */
export function NotFoundPage() {
  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <Seo title="Seite nicht gefunden" noindex />
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">404</p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">Seite nicht gefunden</h1>
        <p className="mt-4 text-slate-300">Diese Seite gibt es nicht (mehr).</p>
        <Link to={Routes.Home} className="btn-outline mt-8 inline-block">Zur Startseite</Link>
      </div>
    </main>
  );
}
