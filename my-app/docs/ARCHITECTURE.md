# Frontend — Architecture

How the React SPA is built. React 19, Vite 8, ESM, Tailwind v4.

Related:

- [`../../DOMAIN.md`](../../DOMAIN.md) — shared vocabulary and invariants
- [`BUSINESS-LOGIC.md`](./BUSINESS-LOGIC.md) — client rules and validation parity
- [`../../backend/docs/ARCHITECTURE.md`](../../backend/docs/ARCHITECTURE.md) — the API
- [`../../README.md`](../../README.md) · [`../../ROADMAP.md`](../../ROADMAP.md)

---

## 1. System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│  CLIENT — React 19 + Vite 8 (SPA)                           │
│  Pages ──► Components ──► Hooks ──► Services ──► Axios      │
│  localStorage: accessToken, pomodoro session                │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTPS / JSON
                               ▼  Express API — see backend docs
```

One static bundle, one backend, one database. See the backend document for the server half
of this diagram.

---

## 2. Repository Layout

```text
my-app/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                    # route table
    ├── axiosInstance.js           # auth + refresh + envelope unwrapping
    ├── index.css                  # Tailwind entry + @theme tokens
    ├── AuthProvider.jsx
    ├── PrivateRoute.jsx
    │
    ├── constants/
    │   ├── navigation.js          # routes, PAGE_TITLES, titleForPath
    │   ├── taskMeta.js            # task enums, labels, recurrence helpers
    │   ├── goalMeta.js            # goal statuses, progress tone
    │   ├── habitMeta.js           # cadences, target bounds
    │   └── projectMeta.js         # colour palette for the picker
    │
    ├── context/
    │   └── AuthContext.js         # split out to fix the react-refresh warning
    │
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useResource.js         # one async resource: isLoading / error / data
    │   ├── useTasks.js            # useTasks, useTask, useStreak, useStats, actions
    │   ├── useGoals.js            # goals + milestones
    │   ├── useProjects.js
    │   └── useHabits.js           # habits + per-habit history
    │
    ├── services/                  # one module per domain, no axios outside http.js
    │   ├── http.js                # toQuery + get/post/put/patch/del
    │   ├── tasks.js
    │   ├── goals.js
    │   ├── milestones.js
    │   ├── projects.js
    │   └── habits.js
    │
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── TasksPage.jsx
    │   ├── TaskDetailPage.jsx
    │   ├── ProjectsPage.jsx
    │   ├── ProjectDetailPage.jsx
    │   ├── GoalsPage.jsx
    │   ├── GoalDetailPage.jsx
    │   ├── HabitsPage.jsx
    │   ├── PlannerPage.jsx
    │   ├── CalendarPage.jsx
    │   ├── FocusPage.jsx
    │   ├── AnalyticsPage.jsx
    │   └── NotFound.jsx
    │
    ├── components/
    │   ├── layout/                # AppShell, Sidebar, Header
    │   ├── tasks/                 # Filters, TaskList, TaskRow, TaskFormPanel
    │   ├── ui/                    # Badge, Button, Checkbox, ConfirmDialog,
    │   │                          # EmptyState, Input, Label, LoadingRow, Modal,
    │   │                          # Notice, ProgressBar, StatCard
    │   └── Register.jsx           # the auth screen (login + register)
    │
    └── utils/
        ├── dates.js               # local day keys, daysBetween, getReminder
        ├── taskAdapter.js         # API task → view task
        └── jwt.js                 # decode exp
```

---

## 3. Layering

```text
App.jsx (route table, providers)
  └─ pages/            route-level composition, data loading
       └─ components/  presentational, feature-local
            └─ hooks/  stateful behaviour, reusable
                 └─ services/  API calls, one function per endpoint
                      └─ axiosInstance.js  auth + refresh interceptors
```

**Components never call `axiosInstance` directly.** Every network call goes through a
service module, so endpoint changes and error normalisation happen in one place. This was
the main structural debt of the pre-Phase-2 build — `CreateTask` and `FetchTask` called
axios inline — and both components have since been deleted along with the pages that
replaced them.

---

## 4. Axios Layer

`src/axiosInstance.js` owns three cross-cutting concerns. Keeping them here means no
component ever deals with them.

### Request

- `withCredentials: true`, so the refresh cookie is sent
- Attaches `Authorization: Bearer <accessToken>` when a token exists

### Response unwrapping

The server returns `{ ok, data }`. A response interceptor unwraps it to `response.data`, so
call sites read `response.data.task` rather than reaching through `response.data.data`.

The envelope stays a transport concern owned by exactly one place. If a future endpoint
returns a bare object, the interceptor passes it through untouched.

### Refresh and 401 replay

- A 401 triggers one refresh via `POST /auth/refresh-token`
- Concurrent 401s share a single in-flight refresh promise, so a page loading three endpoints
  does not fire three refreshes
- On success the new token is stored and the original request is replayed, guarded by a
  `retry` flag so the chain cannot loop
- A response to `/auth/refresh-token` never triggers another refresh
- On failure the token and auth context are cleared and the user is redirected, so a failed
  refresh never leaves someone on a page whose every request 401s

---

## 5. State Strategy

| Tier | Tool | Use for |
|---|---|---|
| Local | `useState` / `useReducer` | Form fields, modal open state, dropdown visibility |
| Shared | Context | Authentication only |
| Server | Service + hook | Anything the API owns |

**Server state is not duplicated into Context, and there is no client-side cache.** Every
list is fetched through `useResource`, which re-runs its loader when the query changes and
exposes `refetch` for the caller to reconcile after a mutation. The queries themselves are
built server-side — filters, search, sort and pagination ride on the request rather than
narrowing a downloaded collection in the browser — so there is little left for a cache to
save. Adding TanStack Query would still be justified if request duplication ever becomes a
measurable problem; it is not needed to keep the UI honest today.

Auth context is the one legitimate exception to "no shared client state", since identity
gates routing.

---

## 6. Routing & Guards

```text
/                    Register (doubles as login, no guard)
/dashboard           PrivateRoute → DashboardPage
/tasks               PrivateRoute → TasksPage
/tasks/:id           PrivateRoute → TaskDetailPage
/projects            PrivateRoute → ProjectsPage
/projects/:id        PrivateRoute → ProjectDetailPage
/goals               PrivateRoute → GoalsPage
/goals/:id           PrivateRoute → GoalDetailPage
/habits              PrivateRoute → HabitsPage
/planner             PrivateRoute → PlannerPage
/calendar            PrivateRoute → CalendarPage
/focus               PrivateRoute → FocusPage
/analytics           PrivateRoute → AnalyticsPage
/create-task         redirect → /tasks     (legacy bookmark)
/timer               redirect → /focus     (legacy bookmark)
*                    NotFound
```

`PrivateRoute` decodes the JWT `exp` claim rather than only checking that a token key exists,
so an expired token redirects instead of stranding the user on a page whose every request
401s. Successful login lands on `/dashboard`.

The client guard is a UX affordance — the server middleware is the actual security boundary.

---

## 7. Client Auth Flow

```text
load → AuthProvider reads localStorage token, decodes exp
        expired/missing → unauthenticated
        valid           → authenticated, no server round trip

API call → 401 → interceptor attempts refresh once
          ├─ success → new token stored, request replayed
          └─ failure → token cleared, context unauthenticated, navigate('/')
```

The auth context lives in `context/AuthContext.js` and the consumer hook in
`hooks/useAuth.js`, rather than both in the provider file. This separates the context
object's identity from the component that supplies its value, which is what fixes the
react-refresh lint warning about fast-refresh exporting non-components.

---

## 8. Design System & Theme

> ✅ **Confirmed.** The palette below was supplied directly. Tokens live in
> `src/index.css` and are the single source of truth for the entire app.

### 8.1 Palette

Dark-mode only. Three accents, neutrals, and nothing else — no blue, amber, or purple
anywhere in the product.

**Accents**

| Role | Token | Hex | Applied to |
|---|---|---|---|
| Primary | `primary` | `#FF7A00` | Primary buttons, active states, key CTAs, selected elements, focus rings |
| Secondary | `secondary` | `#22C55E` | Success states, secondary actions, positive indicators |
| Tertiary | `danger` | `#EF4444` | Destructive actions, errors, delete, negative indicators |

**Neutrals**

| Role | Token | Hex | Applied to |
|---|---|---|---|
| Background | `background` | `#171717` | App shell, page background |
| Sidebar / sunken | `surface-sunken` | `#131313` | Sidebar, wells |
| Surface | `surface` | `#1F1F1F` | Cards, panels, input containers |
| Raised | `surface-raised` | `#202020` | Elevated components, hovers |
| Overlay | `surface-overlay` | `#262626` | Modals, dropdowns, popovers |
| Input | `surface-sunken` | `#111111` | Text inputs |
| Border | `border` | `#2A2A2A` | Low-contrast dividers |
| Border strong | `border-strong` | `#3A3A3A` | Inputs, focus-adjacent borders |

**Content**

| Token | Hex | Applied to |
|---|---|---|
| `content` | `#F5F5F5` | Primary text |
| `content-muted` | `#A3A3A3` | Secondary text, labels |
| `content-subtle` | `#737373` | Placeholders, disabled, tertiary metadata |
| `content-inverse` | `#171717` | Text on top of `primary` and `secondary` fills |

### 8.2 Status → Colour Mapping

The semantic set is three accents. Anything not listed stays neutral.

| Meaning | Token | Hex |
|---|---|---|
| Overdue, error, destructive, delete | `danger` | `#EF4444` |
| Due today, needs attention now, primary action | `primary` | `#FF7A00` |
| Due tomorrow, informational | `content-muted` | neutral |
| Completed, success, positive | `secondary` | `#22C55E` |
| Priority — high | `danger` | `#EF4444` |
| Priority — medium | `primary` | `#FF7A00` |
| Priority — low | `secondary` | `#22C55E` |

**Design note.** The original build labelled Due Today blue and Due Tomorrow yellow. Both are
replaced: "due today" becomes `primary` because it needs action now, and "due tomorrow"
becomes neutral because it is informational rather than urgent. This keeps the palette to the
three specified accents and removes the last stray hues from the app.

### 8.3 Token Structure

Tokens are declared once in `src/index.css` as a Tailwind v4 `@theme` block. There is no
`tailwind.config.js` — v4 reads the theme from CSS.

```css
@import "tailwindcss";

@theme {
    --color-primary: #ff7a00;
    --color-primary-hover: #ea7200;
    --color-primary-soft: #ff7a0026;      /* selected row fill */

    --color-secondary: #22c55e;
    --color-danger: #ef4444;

    --color-background: #171717;
    --color-surface: #1f1f1f;
    --color-surface-raised: #202020;
    --color-surface-overlay: #262626;
    --color-surface-sunken: #131313;

    --color-border: #2a2a2a;
    --color-border-strong: #3a3a3a;

    --color-content: #f5f5f5;
    --color-content-muted: #a3a3a3;
    --color-content-subtle: #737373;

    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

A `@layer base` block sets `color-scheme: dark`, body background and text colour, a
focus-visible ring on every interactive element, placeholder colour, and scrollbar styling.

Consumption is semantic — `bg-surface`, `text-content-muted`, `border-border` — so retheming
is a change to one file rather than a find-and-replace across every component. Stock Tailwind
palette classes are not used anywhere in `src/`.

> **Tree-shaking note.** Tailwind v4 only emits theme variables that are actually referenced.
> A token absent from the built CSS means nothing uses it yet, not that it is misconfigured.

### 8.4 Typography & Shape

| Token | Value |
|---|---|
| `font-sans` | Inter → system-ui → Segoe UI |
| `font-mono` | ui-monospace, Cascadia Code |
| `radius-card` | 12px |
| `radius-control` | 8px |
| `radius-pill` | 9999px |

Inter is referenced but not bundled — it falls back to the system stack until a webfont is
loaded. Add a Google Fonts import at the top of `index.css` if the rendered font must be
Inter specifically.

### 8.5 Layout

| Region | Width | Behaviour |
|---|---|---|
| Sidebar | 190px | Fixed on desktop, off-canvas drawer below `lg` |
| Header | fluid | Sticky; collapses the search field and hides secondary labels on small screens |
| Create-task panel | 268px | Right rail on desktop, full-width sheet on mobile |

The density target is a developer tool: compact control heights, 4–8px radii, minimal
padding, information-dense rows.

### 8.6 Component Conventions

- No raw hex values in JSX. Semantic token classes only.
- One primitive per concern in `components/ui/`.
- Feature components compose primitives; they do not redefine them.
- Status and priority use a single `Badge` with a variant prop, driven by `taskMeta.js`.
- Every interactive element is keyboard reachable with a visible focus ring.

---

## 9. Testing

No client test runner is configured. `npm run lint` and `npm run build` both pass, and CI
runs exactly those two plus the backend suite.

Worth adding: Vitest for `utils/dates.js` in particular — its local-date behaviour is the
subtlest logic in the app and a regression there is silent. The hooks would be the next
candidate, since `useResource`'s three-state contract is what every page depends on.

---

## 10. Deployment

Built with `npm run build` and served as static files. `VITE_BASE_BACKEND_URL` is read at
build time, so changing the API host requires a rebuild.

```text
Static host (Vercel / Netlify) ──► Node host (Render / Railway) ──► MongoDB (Atlas)
```