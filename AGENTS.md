# Concierto App

## Commands

- Use Yarn: `yarn dev`, `yarn lint`, and `yarn build`.
- `yarn build` runs `tsc -b` before the Vite production build; use it for TypeScript validation. No test script or CI workflow is configured.
- After every code or configuration change, run `yarn build` before considering the work complete.

## Application Structure

- This is a single React 19 + TypeScript Vite application. `index.html` loads `src/main.tsx`, which mounts the router through `src/app/providers.tsx`.
- Define routes in `src/router/`; route-level screens belong in `src/pages/`. The current `/` route renders `LoginPage`, while `/dashboard` and `/users` render dashboard views.
- Put feature-specific UI, state, and table definitions in `src/features/<feature>/`. Use `src/widgets/` for larger compositions of features and `src/shared/` only for reusable code without feature ownership.
- Shadcn components belong in `src/shared/components/ui/`; shared helpers live in `src/shared/lib/`. Use the `@/` alias for imports from `src/`.
- Keep Zustand stores feature-scoped. Introduce app-wide state only when it is genuinely shared across independent features.

## UI Dependencies

- Approved packages: `react-router-dom`, `zustand`, `@tanstack/react-table`, `sweetalert2`, `tailwindcss`, `@tailwindcss/vite`, `recharts`, `react-is`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, and `react-icons`. Do not install, replace, or upgrade dependencies without explicit authorization.
- Build responsive interfaces that work on both desktop and mobile viewports.
- Routing uses `react-router-dom`; `AppProviders` owns the root `BrowserRouter`.
- Use `zustand` for client state, `@tanstack/react-table` for headless tables, and `sweetalert2` for notifications. Import `Swal` from `sweetalert2`; no root provider is required.
- Tailwind CSS 4 is loaded first in `src/index.css` through the Vite plugin. Preserve the existing CSS variables and `@theme inline` mappings when changing global styles.
- Shadcn configuration is in `components.json`; it uses `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react`. `cn` is exported by `src/shared/lib/utils.ts`.
- Use `react-icons` for brand and library icons that are not provided by `lucide-react`.
- Charts use the shadcn `ChartContainer`, tooltip, and legend helpers in `src/shared/components/ui/chart.tsx`, built on `recharts`. Its companion `Card` is in the same directory; `react-is` satisfies Recharts' peer dependency.

## Tooling Constraints

- Before handling work covered by an available OpenCode skill, load and follow that skill's instructions.
- Keep imports compatible with TypeScript's bundler configuration: source imports may use `.tsx` extensions, as `main.tsx` does.
- TypeScript enforces unused-local and unused-parameter errors. The project is ESM (`"type": "module"`).
- Linting uses Oxlint with React, TypeScript, and Oxc plugins; Rules of Hooks are errors and `react/only-export-components` is a warning.
- React Compiler is intentionally not enabled.

## Change Safety

- Do not make large, destructive, or potentially disruptive changes to the application without explicit confirmation.
- Before changes that alter routing, global state, dependencies, build configuration, global CSS tokens, or the folder boundaries above, explain the impact and wait for confirmation.
