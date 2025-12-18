/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENVIRONMENT?: "Production" | "Staging" | "Development";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
