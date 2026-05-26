import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint flat config für die broiler.dev-SPA.
 *
 * Aufgebaut analog zu `3roiler/api/eslint.config.mjs`, mit zwei
 * Web-spezifischen Erweiterungen:
 * - `eslint-plugin-react-hooks` für die zwei wichtigen React-Regeln
 *   (rules-of-hooks, exhaustive-deps). Letztere ist `warn`, weil
 *   wir bewusst Effekt-Deps weglassen (z. B. um eine ref nicht zu
 *   triggern) und das case-by-case begründen.
 * - JSX-Parser-Optionen in `languageOptions` damit `.tsx` sauber
 *   geparst wird.
 *
 * Bewusst NICHT eingebunden: `eslint-plugin-react` — die 7.x-Reihe
 * ist noch nicht ESLint-10-kompatibel (peer-conflict). Die Hook-
 * Regeln decken die häufigsten React-Fallen ab; die restlichen
 * Lints (props-types, jsx-no-target-blank, etc.) übernimmt das
 * type-system + CodeQL.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.mjs',
      // Lokales Backup-Verzeichnis (vor `git pull` automatisch erzeugt),
      // gehört nicht ins Repo und nicht in den Lint-Scan.
      '.local-backup/**',
      // Statische Easter-Egg-HTMLs sind kein TS/React-Code:
      'alex.html',
      'huh.html',
      'sasu.html'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true }
      },
      globals: {
        // SPA-typische Globals — Vite + React + DOM.
        window: 'readonly',
        document: 'readonly',
        globalThis: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLPreElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLDivElement: 'readonly',
        Node: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        ScrollBehavior: 'readonly'
      }
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module'
    }
  }
);
