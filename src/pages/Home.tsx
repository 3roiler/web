import { Routes } from "../config/routes";

export function HomePage() {
  return (
    <>
      <header id="top">
        <div className="absolute inset-x-0 right-300 top-40 -z-10 mx-auto h-[700px] w-[700px] rounded-full bg-cyan-500/20 blur-[100px] sm:top-32 sm:h-[400px] sm:w-[400px]"></div>
        
        <div className="mx-auto pt-24 sm:px-10 lg:px-16">
          <div className="grid gap-16 lg:mt-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">Hallo, Welt!</p>
              
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
                So'n Typ für Interesse an DevOps &amp; Cloud Native
              </h1>
              
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-300">
                Persönliche Projekte rund um IT-Administration, Softwareentwicklung und Cloud Native Themen.
              </p>
              
              <div className="mt-12 flex flex-wrap gap-4">
                <a href="#projects" className="btn">Zu den Projekten</a>
                <a href="#contact" className="btn-outline">Kontakt aufnehmen</a>
              </div>
              
              <dl className="mt-16 grid grid-cols-1 gap-6 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="font-medium text-slate-200">Schwerpunkte</dt>
                  <dd className="mt-2 leading-relaxed">IT-Administration, Dotnet, Cloud Native, Web</dd>
                </div>
                
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="font-medium text-slate-200">Stack</dt>
                  <dd className="mt-2 leading-relaxed">Kubernetes, Terraform, C#, TypeScript</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="projects" className="bg-slate-950/60 py-24">
          <div className="mx-auto px-6 sm:px-10 lg:px-16">
            <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">Projekte &amp; Experimente</h2>
              
              <a href={Routes.External.GithubProfile} className="btn-outline" target="_blank" rel="noopener">GitHub Profil</a>
            </div>
            <p className="text-sm text-slate-400">Klick auf die Karten, um mehr zu erfahren</p>
            <div className="mt-16 grid gap-10 md:grid-cols-2 xl:grid-cols-3">
              <a className="card" href={Routes.External.GithubRepositoryWeb} target="_blank" rel="noopener">
                <h3 className="text-lg font-semibold text-slate-50">broiler.dev</h3>
                
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Durchläuft von DevContainer, TypeScript, GitHub Workflows, SonarQube bis DigitalOcean und das alles nur in Visual Studio Code.<br></br><br></br>
                  <strong>Das beste dran?</strong><br></br>
                  Nur DigitalOcean kostet 5€/ Monat :)
                </p>
              </a>
              
              <a className="card" href={Routes.External.GithubRepositoryApi} target="_blank" rel="noopener">
                <h3 className="text-lg font-semibold text-slate-50">api.broiler.dev</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">Eine öffentliche API für diese Seite.<br></br> Jeder braucht doch seine eigene zentrale REST-API.. oder?</p>
              </a>
            </div>
          </div>
        </section>

        <section id="contact" className="bg-slate-950 py-24">
          <div className="mx-auto grid gap-16 px-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:px-16">
            <div className="space-y-10">
              <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">Kontakt &amp; Links</h2>
              
              <ul className="flex flex-wrap gap-3">
                <li><a href={`mailto:${Routes.External.WebmasterEmail}`} className="badge-link">E-Mail</a></li>
                <li><a href={Routes.External.GithubProfile} className="badge-link" target="_blank" rel="noopener">GitHub</a></li>
                <li><a href={Routes.External.LinkedIn} className="badge-link" target="_blank" rel="noopener">LinkedIn</a></li>
                <li><a href={Routes.External.Mastodon} rel="me noopener" className="badge-link" target="_blank">Mastodon</a></li>
              </ul>
            </div>

            <form className="group relative flex flex-col gap-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_20px_40px_-40px_rgba(15,194,207,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_30px_90px_-45px_rgba(15,194,207,0.65)]" action="https://api.broiler.dev/hello" method="post">
              <input type="hidden" name="_subject" value="Neue Anfrage über broiler.dev" />
              <input type="hidden" name="_captcha" value="false" />

              <div className="space-y-8">
                <div>
                  <label htmlFor="name" className="text-sm font-medium text-slate-200">Name</label>
                  <input id="name" name="name" placeholder="Max Mustermann" required autoComplete="name" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-slate-200">E-Mail</label>
                  <input id="email" name="email" type="email" placeholder="max@example.com" required autoComplete="email" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                
                <div>
                  <label htmlFor="message" className="text-sm font-medium text-slate-200">Nachricht</label>
                  <textarea id="message" name="message" placeholder="Worum geht es?" required className="mt-2 w-full min-h-[180px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                
                <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="privacy" value="accepted" required className="accent-cyan-500" />Ich stimme der Verarbeitung meiner Daten zum Zweck der Kontaktaufnahme zu.
                  </label>
                  <a href={Routes.Datenschutz} className="text-cyan-300 decoration-dotted hover:text-cyan-200">Datenschutz einsehen</a>
                </div>
                
                <button type="submit" className="btn w-full sm:w-auto">Nachricht senden</button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}