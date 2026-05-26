<!--
  PR-Template für 3roiler/web.

  Hinweise:
  - Wenn der Change einen IDEA-NN aus ROADMAP.md adressiert, im Titel
    referenzieren (z. B. "feat(seo): … (IDEA-09)").
  - Bei API-Abhängigkeiten den Companion-PR im api-Repo verlinken UND die
    Deploy-Reihenfolge im "Deploy notes"-Block dokumentieren.
  - SonarCloud, CodeQL, Lighthouse-CI laufen automatisch. lhci-Schwellen
    sind "warn", kein hartes Gate.
-->

## Summary

<!-- 1–3 Sätze: was ändert sich und warum. -->

## Changes

<!-- Bullet-Liste der konkreten Änderungen. Bei neuen Routes auch den
     Routes-Konfig-Eintrag erwähnen. -->

-

## Test plan

<!-- Was wurde lokal geprüft? Was nach Deploy verifizieren?
     Mindestens typecheck + ein manueller Klickpfad. -->

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vite build` clean
- [ ]

## Deploy notes

<!-- Optional. Companion-PR im api-Repo? Reihenfolge? Caddyfile-Änderung,
     die nur nach API-Deploy Sinn ergibt? Sonst löschen. -->

## Roadmap reference

<!-- Wenn dieser PR einen IDEA-NN aus ROADMAP.md schließt oder anstößt. -->

Closes IDEA-NN <!-- oder: Part of IDEA-NN, Blocked-by IDEA-NN -->
