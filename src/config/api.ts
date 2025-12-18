/**
 * API Konfiguration
 * Ermöglicht das Wechseln zwischen verschiedenen API-Umgebungen.
 */

export const ApiEnvironments = {
  Production: "https://api.broiler.dev/prod",
  Staging: "https://api.broiler.dev/staging",
  Development: "http://localhost:3000",
} as const;

export type ApiEnvironment = keyof typeof ApiEnvironments;

const LOCAL_STORAGE_KEY = "api_environment";

/**
 * Ermittelt die Standard-API-Umgebung basierend auf dem Vite-Modus.
 */
function getDefaultEnvironment(): ApiEnvironment {
  if (import.meta.env.DEV) {
    return "Development";
  }
  return "Production";
}

/**
 * Liest die aktuell konfigurierte API-Umgebung.
 * Priorisierung: LocalStorage > Environment > Default
 */
export function getApiEnvironment(): ApiEnvironment {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored && stored in ApiEnvironments) {
    return stored as ApiEnvironment;
  }

  const envOverride = import.meta.env.VITE_API_ENVIRONMENT;
  if (envOverride && envOverride in ApiEnvironments) {
    return envOverride as ApiEnvironment;
  }

  return getDefaultEnvironment();
}

/**
 * Setzt die API-Umgebung (wird im LocalStorage gespeichert).
 */
export function setApiEnvironment(env: ApiEnvironment): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, env);
}

/**
 * Entfernt die API-Umgebung aus dem LocalStorage (zurück zum Default).
 */
export function resetApiEnvironment(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Gibt die aktuelle API-Base-URL zurück.
 */
export function getApiBaseUrl(): string {
  return ApiEnvironments[getApiEnvironment()];
}

/**
 * Debug-Hilfsfunktionen für die Browser-Konsole.
 * Verwendung: window.__api.switch("Staging")
 */
if (import.meta.env.DEV) {
  (globalThis as any).__api = {
    environments: ApiEnvironments,
    current: () => getApiEnvironment(),
    url: () => getApiBaseUrl(),
    switch: (env: ApiEnvironment) => {
      setApiEnvironment(env);
      console.log(`API switched to: ${env} (${ApiEnvironments[env]})`);
      console.log("Reload the page to apply changes.");
    },
    reset: () => {
      resetApiEnvironment();
      console.log("API reset to default.");
    },
  };

  console.log(
    `[API Config] Environment: ${getApiEnvironment()} | URL: ${getApiBaseUrl()}\n` +
    `Use window.__api.switch("Production"|"Staging"|"Development") to change.`
  );
}
