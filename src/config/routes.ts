/**
 * Zentrale Routen-Definition
 * Alle Pfade werden hier definiert, um Änderungen an einer Stelle vornehmen zu können.
 *
 * Alle Admin-/Verwaltungsseiten liegen unter `/dashboard/*`. Die alten
 * `/admin/*` und `/blog/admin` Pfade sind entfernt — ohne Redirects, weil
 * nur Paul sie kennt und die Seiten ohnehin noch in aktiver Entwicklung
 * sind.
 */

export const Routes = {
  Home: "/",
  Impressum: "/impressum",
  Datenschutz: "/datenschutz",
  Blog: "/blog",
  BlogPost: "/blog/:slug",
  Profile: "/profile",
  PrintRequest: "/druckanfrage",

  // Streamclips Germany — öffentlicher Bereich.
  Streamclips: {
    Home: "/streamclips",
    Vote: "/streamclips/vote",
    Submit: "/streamclips/submit",
    Leaderboard: "/streamclips/leaderboard",
    ClipDetail: "/streamclips/clip/:id",
    Me: "/streamclips/me",
  },

  Dashboard: {
    Home: "/dashboard",
    Blog: "/dashboard/blog",
    BlogNew: "/dashboard/blog/new",
    BlogEdit: "/dashboard/blog/edit/:id",
    Users: "/dashboard/users",
    Groups: "/dashboard/groups",
    GroupDetail: "/dashboard/groups/:id",
    Settings: "/dashboard/settings",
    Metrics: "/dashboard/metrics",
    Printers: "/dashboard/printers",
    PrinterNew: "/dashboard/printers/new",
    PrinterDetail: "/dashboard/printers/:id",
    PrinterJobs: "/dashboard/printers/:id/jobs",
    Gcode: "/dashboard/gcode",
    GcodeNew: "/dashboard/gcode/new",
    GcodeEdit: "/dashboard/gcode/:id/edit",
    Stl: "/dashboard/stl",
    StlViewer: "/dashboard/stl/:id",
    PrintRequests: "/dashboard/druckanfragen",
    PrintRequestDetail: "/dashboard/druckanfragen/:id",
    // Streamclips-Moderation
    Clips: "/dashboard/clips",
    ClipsAwards: "/dashboard/clips/awards",
    ClipsCategories: "/dashboard/clips/categories",
    ClipsSettings: "/dashboard/clips/settings",
    ClipsReports: "/dashboard/clips/reports"
  },

  Callback: {
    Github: "/callback/github",
    Twitch: "/callback/twitch",
    Error: "/callback/error",
  },
  External: {
    PaulEmail: "paul@broiler.dev",
    WebmasterEmail: "webmaster@broiler.dev",
    GithubProfile: "https://github.com/3roiler",
    GithubRepositoryWeb: "https://github.com/3roiler/web",
    GithubRepositoryApi: "https://github.com/3roiler/api",
    LinkedIn: "https://www.linkedin.com/in/paul-wechselberger-6133b3282/",
    Mastodon: "https://mastodon.social/@broiler",
    GithubOauth: "https://github.com/login/oauth/authorize",
    TwitchOauth: "https://id.twitch.tv/oauth2/authorize",
    Sonarcloud: "https://sonarcloud.io/dashboard?id=3roiler_web",
    DigitalOcean: "https://www.digitalocean.com/?refcode=203d563657de&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge",
    PayPal: "https://paypal.me/bleikind"
  }
} as const;

// Typen für die Routen (optional, für bessere Typensicherheit)
export type RouteKey = keyof typeof Routes;

/**
 * Hilfsfunktion zum Navigieren (für window.location Redirects)
 */
export function navigateTo(path: string): void {
  globalThis.location.href = path;
}
