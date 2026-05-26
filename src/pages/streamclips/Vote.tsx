import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { ClipEmbed } from "../../components/streamclips/ClipEmbed";
import { AwardChip } from "../../components/streamclips/AwardChip";
import { StarRating } from "../../components/streamclips/StarRating";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import {
  getMe,
  getAwards,
  getSections,
  getNextClip,
  rateClip,
  loginToTwitch,
  ApiError,
  type User,
  type AwardCategory,
  type SectionOption,
  type ClipSection,
  type ClipWithContext
} from "../../services";

/**
 * Vote-Feed — der Kern-Loop. Holt einen zufälligen, noch nicht
 * bewerteten Clip, der Nutzer vergibt Sterne + passende Awards oder
 * skippt. Tastatur: 1–5 Sterne, S = Skip, Enter = Bewerten.
 */
export function VotePage() {
  const [me, setMe] = React.useState<User | null | undefined>(undefined);
  const [awards, setAwards] = React.useState<AwardCategory[]>([]);
  const [sections, setSections] = React.useState<SectionOption[]>([]);
  const [section, setSection] = React.useState<ClipSection | undefined>(undefined);

  const [clip, setClip] = React.useState<ClipWithContext | null | undefined>(undefined);
  const [score, setScore] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [votedCount, setVotedCount] = React.useState(0);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
    getAwards()
      .then(setAwards)
      .catch(() => undefined);
    getSections()
      .then(setSections)
      .catch(() => undefined);
  }, []);

  const loadNext = React.useCallback(async () => {
    setClip(undefined);
    setScore(0);
    setSelected(new Set());
    setError(null);
    try {
      const next = await getNextClip(section);
      setClip(next);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Clip konnte nicht geladen werden.");
      setClip(null);
    }
  }, [section]);

  // Erst laden, wenn klar ist, dass der Nutzer angemeldet ist.
  React.useEffect(() => {
    if (me) loadNext();
  }, [me, loadNext]);

  const toggleAward = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const submit = React.useCallback(
    async (skipped: boolean) => {
      if (!clip || busy) return;
      if (!skipped && score === 0) {
        setError("Bitte Sterne vergeben oder den Clip überspringen.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await rateClip(clip.id, skipped ? { skipped: true } : { score, awardIds: [...selected] });
        setVotedCount((c) => c + 1);
        await loadNext();
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Bewertung fehlgeschlagen.");
      } finally {
        setBusy(false);
      }
    },
    [clip, busy, score, selected, loadNext]
  );

  // Tastatursteuerung. Re-bindet bei State-Wechsel, damit die Closure
  // stets den aktuellen Score/Auswahl sieht.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!me || busy || !clip) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key >= "1" && e.key <= "5") setScore(Number(e.key));
      else if (e.key.toLowerCase() === "s") submit(true);
      else if (e.key === "Enter") submit(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me, busy, clip, submit]);

  if (me === undefined) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">Lade…</p>
      </Shell>
    );
  }

  if (!me) {
    return (
      <Shell>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-slate-300">Melde dich mit Twitch an, um Clips zu bewerten.</p>
          <button type="button" onClick={() => loginToTwitch()} className={TWITCH_BTN}>
            Mit Twitch anmelden
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Heute bewertet:{" "}
          <span className="font-semibold text-cyan-300 tabular-nums">{votedCount}</span>
        </p>
        <SectionFilter sections={sections} value={section} onChange={setSection} />
      </div>

      {clip === undefined && <p className="text-sm text-slate-400">Lade nächsten Clip…</p>}

      {clip === null && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-2 text-sm text-slate-300">
            Keine offenen Clips{section ? " in dieser Sektion" : ""} mehr — alles bewertet!
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {section && (
              <button
                type="button"
                onClick={() => setSection(undefined)}
                className="btn-outline btn-sm"
              >
                Alle Sektionen
              </button>
            )}
            <Link to={Routes.Streamclips.Leaderboard} className="btn btn-sm">
              Zum Leaderboard
            </Link>
          </div>
        </div>
      )}

      {clip && (
        <div className="space-y-5">
          <ClipEmbed clipId={clip.twitchClipId} title={clip.title} />

          <div>
            <h2 className="text-base font-semibold text-slate-50">{clip.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {clip.broadcasterName ?? "?"}
              {clip.categoryName && <> · {clip.categoryName}</>}
              {clip.creatorName && <> · Clip von {clip.creatorName}</>}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-5">
            <p className="text-xs uppercase tracking-wider text-slate-400">Deine Wertung</p>
            <StarRating value={score} onChange={setScore} size="lg" />
            <p className="text-xs text-slate-500">
              Tasten 1–5 · S zum Überspringen · Enter zum Bewerten
            </p>
          </div>

          {awards.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">
                Passt das? (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {awards.map((a) => (
                  <AwardChip
                    key={a.id}
                    emoji={a.emoji}
                    label={a.displayName}
                    color={a.color}
                    selected={selected.has(a.id)}
                    onClick={() => toggleAward(a.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={busy}
              className="btn-outline"
            >
              Überspringen
            </button>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={busy}
              className={`${TWITCH_BTN} flex-1`}
            >
              {busy ? "Speichere…" : "Bewerten & weiter"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

const TWITCH_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8] disabled:opacity-50";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-12 lg:pt-16">
        <header className="mb-6 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
            Streamclips Germany 🇩🇪
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Clips bewerten</h1>
        </header>
        <StreamclipsNav />
        {children}
      </div>
    </main>
  );
}

interface SectionFilterProps {
  sections: SectionOption[];
  value: ClipSection | undefined;
  onChange: (s: ClipSection | undefined) => void;
}

function SectionFilter({ sections, value, onChange }: SectionFilterProps) {
  if (sections.length === 0) return null;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as ClipSection | undefined)}
      className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200"
      aria-label="Sektion filtern"
    >
      <option value="">Alle Sektionen</option>
      {sections.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
