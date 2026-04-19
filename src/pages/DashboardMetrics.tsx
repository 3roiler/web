import * as React from "react";
import {
  ApiError,
  getMetricsStatus,
  listMetricsApps,
  getAppSummary,
  getDatabaseSummary,
  getAppCpu,
  getAppMemory,
  getDatabaseCpu,
  getDatabaseMemory,
  getDatabaseDisk,
  type DoTimeSeriesResponse,
  type MetricsApp,
  type MetricsStatus,
  type MetricsWindow
} from "../services";
import { DashboardLayout } from "../components/DashboardLayout";
import { Link } from "react-router-dom";
import { Routes } from "../config/routes";

/**
 * `/dashboard/metrics` — visualises the DigitalOcean proxy.
 *
 * The page is structured as:
 *   - Toolbar (window, auto-refresh, manual refresh)
 *   - Summary strip: one App-Platform card per configured app + one DB card
 *   - One "App Platform · <label>" chart section per configured app
 *   - One "Managed Postgres" chart section for the single cluster
 *
 * Why a hand-rolled SVG instead of Recharts/Chart.js?
 *   - We only draw a handful of line charts; the full chart lib pulls in
 *     ~80 kB gzip we'd otherwise ship on a route that already sits behind
 *     a permission gate.
 *   - DO returns Prometheus-shape `[ts, "value"][]` per series — a simple
 *     polyline does the job and keeps deploys snappy.
 *
 * Auto-refresh uses a toggle + interval select so the operator can watch
 * load live during a deploy without remembering to hit reload. Backend
 * already caches at 30 s so even aggressive refresh won't hammer DO.
 */

const WINDOW_OPTIONS: readonly { value: MetricsWindow; label: string }[] = [
  { value: "1h", label: "1 Stunde" },
  { value: "6h", label: "6 Stunden" },
  { value: "24h", label: "24 Stunden" }
];

// Interval options in seconds. Picked so "Live" feels snappy without
// spamming the API; 0 is the sentinel for "aus".
const REFRESH_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: "Aus" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" }
];

export function DashboardMetricsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.metrics"
      kicker="Dashboard · Metriken"
      title="DigitalOcean Metriken"
      description={
        <>
          CPU, Arbeitsspeicher und Disk-Auslastung pro konfigurierter App Platform und des
          Managed-Postgres. Werte werden 30 Sekunden API-seitig gecached, darum sind kurze
          Live-Intervalle hier unbedenklich.
        </>
      }
    >
      {() => <MetricsContent />}
    </DashboardLayout>
  );
}

function MetricsContent() {
  const [status, setStatus] = React.useState<MetricsStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [apps, setApps] = React.useState<MetricsApp[] | null>(null);
  const [window, setWindow] = React.useState<MetricsWindow>("1h");
  const [refreshSeconds, setRefreshSeconds] = React.useState<number>(0);
  // `tick` bumps on every auto-refresh; children re-fetch when it changes.
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    // Status tells us whether config is complete; the apps list powers every
    // per-app widget. Running them in parallel keeps the page responsive and
    // lets the UI render partial state (e.g. DB-only) if the apps call fails.
    getMetricsStatus()
      .then((s) => {
        setStatus(s);
        setStatusError(null);
        setRefreshSeconds((current) =>
          current === 0 && s.refreshDefaultSeconds > 0 ? s.refreshDefaultSeconds : current
        );
      })
      .catch((e: unknown) => {
        console.error(e);
        setStatusError(e instanceof ApiError ? e.message : "Status konnte nicht geladen werden.");
      });

    listMetricsApps()
      .then((list) => setApps(list))
      .catch(() => setApps([]));
  }, []);

  React.useEffect(() => {
    if (refreshSeconds <= 0) return;
    const handle = globalThis.setInterval(() => setTick((t) => t + 1), refreshSeconds * 1000);
    return () => globalThis.clearInterval(handle);
  }, [refreshSeconds]);

  if (statusError) {
    return <p className="text-sm text-red-300">{statusError}</p>;
  }
  if (!status || !apps) {
    return <p className="text-sm text-slate-400">Lade…</p>;
  }

  // Show the config gate only when nothing is workable. Partial setups still
  // render what they can — a missing DB shouldn't hide the apps block.
  const anythingUsable = status.tokenConfigured && (status.appsConfigured > 0 || status.databaseIdConfigured);
  if (!anythingUsable) {
    return <ConfigurationMissing status={status} />;
  }

  return (
    <div className="space-y-8">
      <Toolbar
        window={window}
        onWindow={setWindow}
        refreshSeconds={refreshSeconds}
        onRefreshSeconds={setRefreshSeconds}
        onManualRefresh={() => setTick((t) => t + 1)}
      />

      <SummariesBlock tick={tick} apps={apps} dbIdConfigured={status.databaseIdConfigured} />

      {apps.map((app) => (
        <section key={app.id}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">
            App Platform · {app.label}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="CPU"
              unit="%"
              window={window}
              tick={tick}
              fetcher={(w) => getAppCpu(app.id, w)}
            />
            <ChartCard
              title="Memory"
              unit="%"
              window={window}
              tick={tick}
              fetcher={(w) => getAppMemory(app.id, w)}
            />
          </div>
        </section>
      ))}

      {status.databaseIdConfigured && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Managed Postgres</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="CPU" unit="%" window={window} tick={tick} fetcher={getDatabaseCpu} />
            <ChartCard title="Memory" unit="%" window={window} tick={tick} fetcher={getDatabaseMemory} />
            <ChartCard title="Disk" unit="%" window={window} tick={tick} fetcher={getDatabaseDisk} />
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Configuration gate ────────────────────────────────────────────────────

function ConfigurationMissing({ status }: { status: MetricsStatus }) {
  const rows: { label: string; ok: boolean }[] = [
    { label: "digitalocean.token (Secret)", ok: status.tokenConfigured },
    { label: `digitalocean.apps (${status.appsConfigured} konfiguriert)`, ok: status.appsConfigured > 0 },
    { label: "digitalocean.database_id", ok: status.databaseIdConfigured }
  ];
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <h2 className="text-lg font-semibold text-amber-100">Konfiguration unvollständig</h2>
      <p className="mt-2 text-sm text-amber-200/80">
        Die Metriken-Seite greift auf die DigitalOcean v2-API zu. Dazu müssen ein API-Token (mit
        <code className="mx-1 rounded bg-black/30 px-1 font-mono text-xs">monitoring:read</code>
        Scope) und mindestens eine App oder Datenbank konfiguriert sein.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-slate-200">
            <span
              aria-hidden
              className={
                r.ok
                  ? "inline-block h-2 w-2 rounded-full bg-cyan-400"
                  : "inline-block h-2 w-2 rounded-full bg-red-400"
              }
            />
            <code className="font-mono text-xs text-slate-300">{r.label}</code>
            <span className={r.ok ? "text-xs text-cyan-300" : "text-xs text-red-300"}>
              {r.ok ? "gesetzt" : "fehlt"}
            </span>
          </li>
        ))}
      </ul>
      <Link to={Routes.Dashboard.Settings} className="btn btn-sm mt-6 inline-block">
        Zu den Einstellungen
      </Link>
    </div>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────

interface ToolbarProps {
  window: MetricsWindow;
  onWindow: (w: MetricsWindow) => void;
  refreshSeconds: number;
  onRefreshSeconds: (s: number) => void;
  onManualRefresh: () => void;
}

function Toolbar({ window, onWindow, refreshSeconds, onRefreshSeconds, onManualRefresh }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-400">Zeitraum</span>
        <div className="flex gap-1">
          {WINDOW_OPTIONS.map((opt) => {
            const active = opt.value === window;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onWindow(opt.value)}
                className={
                  active
                    ? "rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 transition hover:text-slate-200"
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-400">Auto-Refresh</span>
        <select
          value={refreshSeconds}
          onChange={(e) => onRefreshSeconds(Number(e.target.value))}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
        >
          {REFRESH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {refreshSeconds > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-cyan-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            Live
          </span>
        )}
      </div>

      <button type="button" onClick={onManualRefresh} className="btn-outline btn-sm ml-auto">
        Neu laden
      </button>
    </div>
  );
}

// ─── Summary cards (app + database top-line status) ────────────────────────

interface SummariesBlockProps {
  tick: number;
  apps: MetricsApp[];
  dbIdConfigured: boolean;
}

function SummariesBlock({ tick, apps, dbIdConfigured }: SummariesBlockProps) {
  if (apps.length === 0 && !dbIdConfigured) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {apps.map((app) => (
        <AppSummaryCard key={app.id} app={app} tick={tick} />
      ))}
      {dbIdConfigured && <DatabaseSummaryCard tick={tick} />}
    </div>
  );
}

interface AppSummaryShape {
  app?: {
    id?: string;
    spec?: { name?: string; region?: string };
    default_ingress?: string;
    active_deployment?: {
      phase?: string;
      updated_at?: string;
    };
    live_url?: string;
    updated_at?: string;
  };
}

function AppSummaryCard({ app, tick }: { app: MetricsApp; tick: number }) {
  const [data, setData] = React.useState<AppSummaryShape | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getAppSummary<AppSummaryShape>(app.id)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "App-Status nicht verfügbar.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick, app.id]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold text-slate-100">App Platform · {app.label}</h3>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {!error && !data && <p className="mt-2 text-xs text-slate-400">Lade…</p>}
      {data?.app && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Field label="Name" value={data.app.spec?.name ?? "—"} />
          <Field label="Region" value={data.app.spec?.region ?? "—"} />
          <Field label="Phase" value={data.app.active_deployment?.phase ?? "—"} />
          <Field
            label="Letztes Deploy"
            value={formatTimestamp(data.app.active_deployment?.updated_at ?? data.app.updated_at)}
          />
          {data.app.live_url && (
            <Field
              label="Live-URL"
              value={
                <a
                  href={data.app.live_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 underline decoration-dotted"
                >
                  {data.app.live_url.replace(/^https?:\/\//, "")}
                </a>
              }
              fullWidth
            />
          )}
        </dl>
      )}
    </div>
  );
}

interface DatabaseSummaryShape {
  database?: {
    name?: string;
    engine?: string;
    version?: string;
    region?: string;
    size?: string;
    num_nodes?: number;
    status?: string;
    connection?: { host?: string; port?: number; database?: string };
  };
}

function DatabaseSummaryCard({ tick }: { tick: number }) {
  const [data, setData] = React.useState<DatabaseSummaryShape | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getDatabaseSummary<DatabaseSummaryShape>()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "DB-Status nicht verfügbar.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold text-slate-100">Managed Postgres</h3>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {!error && !data && <p className="mt-2 text-xs text-slate-400">Lade…</p>}
      {data?.database && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Field label="Name" value={data.database.name ?? "—"} />
          <Field
            label="Engine"
            value={
              data.database.engine
                ? `${data.database.engine} ${data.database.version ?? ""}`.trim()
                : "—"
            }
          />
          <Field label="Größe" value={data.database.size ?? "—"} />
          <Field label="Nodes" value={String(data.database.num_nodes ?? "—")} />
          <Field label="Region" value={data.database.region ?? "—"} />
          <Field label="Status" value={data.database.status ?? "—"} />
        </dl>
      )}
    </div>
  );
}

function Field({ label, value, fullWidth }: { label: string; value: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-200">{value}</dd>
    </div>
  );
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE");
}

// ─── Chart card ────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  unit: string;
  window: MetricsWindow;
  tick: number;
  fetcher: (window: MetricsWindow) => Promise<DoTimeSeriesResponse>;
}

function ChartCard({ title, unit, window, tick, fetcher }: ChartCardProps) {
  const [data, setData] = React.useState<DoTimeSeriesResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher(window)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Daten nicht verfügbar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [window, tick, fetcher]);

  const series = flattenSeries(data);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {loading && <span className="text-[10px] uppercase tracking-wider text-slate-500">lädt…</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {!error && series.length === 0 && !loading && (
        <p className="mt-2 text-xs text-slate-500">Keine Daten für dieses Fenster.</p>
      )}
      {series.length > 0 && (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-cyan-200">{formatCurrent(series, unit)}</span>
            <span className="text-xs text-slate-500">aktuell</span>
          </div>
          <LineChart series={series} unit={unit} />
        </>
      )}
    </div>
  );
}

interface Point {
  t: number;
  v: number;
}

function flattenSeries(data: DoTimeSeriesResponse | null): Point[] {
  if (!data?.data?.result?.length) return [];
  // Most DO metrics return a single series — if there are multiple (e.g.
  // per-component CPU), we average them so the chart stays legible. Per-
  // series drill-down can come later.
  const allSeries = data.data.result
    .map((r) => r.values)
    .filter((values) => Array.isArray(values) && values.length > 0);
  if (allSeries.length === 0) return [];

  if (allSeries.length === 1) {
    return allSeries[0].map(([t, v]) => ({ t, v: Number(v) }));
  }

  // Zip by index (DO returns same-length arrays because it aligns the
  // timestamps). Fallback to the first series if lengths disagree.
  const baseline = allSeries[0];
  return baseline.map(([t], i) => {
    let sum = 0;
    let count = 0;
    for (const s of allSeries) {
      const entry = s[i];
      if (entry) {
        const n = Number(entry[1]);
        if (Number.isFinite(n)) {
          sum += n;
          count += 1;
        }
      }
    }
    return { t, v: count > 0 ? sum / count : 0 };
  });
}

function formatCurrent(series: Point[], unit: string): string {
  const last = series[series.length - 1];
  if (!last || !Number.isFinite(last.v)) return "—";
  const asPercent = unit === "%" && last.v <= 1;
  const scaled = asPercent ? last.v * 100 : last.v;
  return `${scaled.toFixed(1)} ${unit}`;
}

// ─── Minimal SVG line chart ────────────────────────────────────────────────

const CHART_W = 320;
const CHART_H = 100;
const PAD_X = 4;
const PAD_Y = 8;

function LineChart({ series, unit }: { series: Point[]; unit: string }) {
  if (series.length < 2) {
    // Single point — still show the value above, but no polyline to draw.
    return (
      <div className="mt-2 text-xs text-slate-500">Nicht genug Datenpunkte für einen Verlauf.</div>
    );
  }

  const values = series.map((p) => p.v);
  const isPercent = unit === "%" && values.every((v) => v <= 1);
  const scaled = values.map((v) => (isPercent ? v * 100 : v));

  const vMin = Math.min(...scaled);
  const vMax = Math.max(...scaled);
  const vRange = vMax - vMin || 1; // avoid div-by-0 on flat lines

  const tMin = series[0].t;
  const tMax = series[series.length - 1].t;
  const tRange = tMax - tMin || 1;

  const points = series
    .map((p) => {
      const x = PAD_X + ((p.t - tMin) / tRange) * (CHART_W - PAD_X * 2);
      const yValue = isPercent ? p.v * 100 : p.v;
      const y = CHART_H - PAD_Y - ((yValue - vMin) / vRange) * (CHART_H - PAD_Y * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const fillPoints = `${PAD_X},${CHART_H - PAD_Y} ${points} ${CHART_W - PAD_X},${CHART_H - PAD_Y}`;

  const fmtValue = (v: number) => (isPercent ? `${v.toFixed(0)}${unit}` : `${v.toFixed(1)}`);

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="mt-3 h-24 w-full"
      role="img"
      aria-label={`Verlauf (Min ${fmtValue(vMin)}, Max ${fmtValue(vMax)})`}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Baseline / max reference lines — subtle grid so eyes catch scale. */}
      <line x1={PAD_X} x2={CHART_W - PAD_X} y1={PAD_Y} y2={PAD_Y} stroke="rgba(255,255,255,0.06)" />
      <line
        x1={PAD_X}
        x2={CHART_W - PAD_X}
        y1={CHART_H - PAD_Y}
        y2={CHART_H - PAD_Y}
        stroke="rgba(255,255,255,0.06)"
      />
      <polygon points={fillPoints} fill="url(#chartFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="rgb(34 211 238)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text x={PAD_X} y={PAD_Y + 8} className="fill-slate-500" fontSize="9">
        {fmtValue(vMax)}
      </text>
      <text x={PAD_X} y={CHART_H - PAD_Y - 2} className="fill-slate-500" fontSize="9">
        {fmtValue(vMin)}
      </text>
    </svg>
  );
}
