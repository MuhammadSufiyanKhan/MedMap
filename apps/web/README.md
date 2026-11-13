# @medmap/web

React single-page app for MedMap.

## Scripts

| Script            | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Vite dev server on port 5173        |
| `npm run build`   | Typecheck and production build      |
| `npm run preview` | Serves the production build on 4173 |
| `npm test`        | Component and unit tests            |

Run them from the repository root with `-w @medmap/web`.

## Folder map

```text
src/
  presentation/  pages, layouts, feature components, ui primitives
  application/   hooks, queries, forms, UI state, animation hooks
  services/      typed API client, no React
  domain/        types, constants, pure functions
  app/           routing, providers, bootstrap, global CSS
tests/           component and unit tests
e2e/             Playwright tests
```

## Layer rules

Imports flow downward only: presentation, application, services, domain. ESLint fails the
build otherwise.

- Presentation renders props and handles events. It never fetches and never imports GSAP.
- Application orchestrates services and owns animation hooks.
- Services have no React imports.
- Domain is pure and fully unit-tested.

Styling is Tailwind only, with semantic tokens from `tailwind.config.ts`.
