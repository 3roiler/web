/**
 * Zentrale Routen-Definition
 * Alle Pfade werden hier definiert, um Änderungen an einer Stelle vornehmen zu können.
 */

export const Routes = {
  Home: "/",
  Impressum: "/impressum",
  Datenschutz: "/datenschutz",
  Callback: {
    Github: "/callback/github",
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
