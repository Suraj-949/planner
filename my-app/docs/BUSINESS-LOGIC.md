# Frontend — Business Logic

Client-side rules. These exist for fast feedback and **never replace** the server rules in
[`../../backend/docs/BUSINESS-LOGIC.md`](../../backend/docs/BUSINESS-LOGIC.md).

Shared vocabulary, principles, and invariants live in [`../../DOMAIN.md`](../../DOMAIN.md).
Architecture is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 1. Client Validation Rules

Client validation **duplicates** server rules to give fast feedback. When the two disagree,
the server wins.

| Field | Client rule | Server rule |
|---|---|---|
| `title` | Required, non-empty after trim | R-TASK-1 |
| `deadline` | Required, must parse | R-TASK-2 |
| `status` | One of three options | R-TASK-3 |
| `priority` | One of three options | R-TASK-4 |
| `category` | One of six options | R-TASK-5 |
| `password` (register) | ≥ 8 characters | Server-authoritative only |
| `email` (register) | Basic shape check | Server-authoritative only |

**Client-side email validation is a convenience only.** The client has no authority over
uniqueness, normalisation, or the actual format contract.

**The server response wins.** When a request fails, the message from
`err.response.data.message` is what the user sees. Client-side messages are pre-emptive, not
authoritative.

---

## 2. Auth State Rules

| Rule | Detail |
|---|---|
| R-CAUTH-1 | Authentication state is derived from token presence **and** unexpired `exp` claim |
| R-CAUTH-2 | An expired token with no successful refresh → unauthenticated, redirect to `/` |
| R-CAUTH-3 | The refresh interceptor attempts **one** refresh per request, bounded by the `retry` flag on the request config |
| R-CAUTH-4 | A failed refresh clears the token and the auth context. It must not leave the user on a protected page |
| R-CAUTH-5 | Logout calls `POST /auth/logout` **before** clearing local state, so the refresh cookie is cleared server-side |
| R-CAUTH-6 | Route guards are a UX affordance. The server middleware is the security boundary |
| R-CAUTH-7 | Nothing sensitive is rendered before a 401 response is resolved |

---

## 3. Rendering Rules

| Rule | Detail |
|---|---|
| R-UI-1 | No component hardcodes a hex colour. Semantic token classes only |
| R-UI-2 | Enum option lists come from `constants/taskMeta.js`, never inline arrays |
| R-UI-3 | A destructive action requires confirmation |
| R-UI-4 | Every async action exposes loading and error states |
| R-UI-5 | Modals trap focus, close on Escape, and lock body scroll |
| R-UI-6 | The list has a defined empty state, distinct from the error state |
| R-UI-7 | Toast notifications auto-dismiss after 3 seconds |

---

## 4. Date Handling

The client must not reintroduce the UTC-parsing bug the server already fixed.

| Rule | Detail |
|---|---|
| R-CDATE-1 | `YYYY-MM-DD` from a date input is parsed as a **local** date, never `new Date(string)` |
| R-CDATE-2 | Day differences use whole local days. `millisecond / 86400000` across offsets is wrong |
| R-CDATE-3 | Formatting and comparing both go through `utils/dates.js`. A second inline implementation is a defect |
| R-CDATE-4 | A deadline received from the API is already anchored at local noon by the server. The client must not re-anchor it |

The shared `formatDateKey` helper exists because reminder labels and streak logic previously
used two different date normalisations and disagreed by a day behind UTC.

---

## 5. What Runs Client-Side Today, and Why It Is Fragile

| Logic | Current location | Risk | Resolution |
|---|---|---|---|
| Streak | `localStorage` | Leaks across users, survives logout, lost on device change | Move server-side — Phase 2 |
| Reminder labels | Derived in `FetchTask` | Duplicates date logic, will drift from any server version | Share one date util, then move server-side |
| Completion rate | Derived in `FetchTask` | Lifetime-scoped, so it only ever dilutes | Period-scoped analytics — Phase 2 |
| Pomodoro state | `localStorage` | Not visible on another device, lost if storage is cleared | Record sessions server-side — Phase 3 |
| Enum option lists | Hardcoded in 2 JSX files | Silently diverge from the Mongoose schema | Single shared constants module — Phase 2 |
| Form validation | Per component | Three copies of similar rules drift apart | Shared validators — Phase 2 |
| Dashboard task list | Component state seeded from `seedTasks.js` | Nothing persists; a refresh loses every change | Wire to the task API |

**The pattern:** the client owns state the server should own. Each one is defensible
individually and collectively they mean a user's productivity data lives in one browser
profile instead of their account.

---

## 6. Known Gaps

| Gap | Detail |
|---|---|
| Board and Calendar views | Active state exists, rendered content does not |
| "Start Focus Now" in the create panel | Button renders but has no handler |
| Sidebar quick-jump | Passes a value to an event-shaped handler, so the input never filters |
| Task persistence | Create, complete, and delete mutate local state only |
| `CreateTaskModal` accessibility | No `role="dialog"`, focus trap, Escape handling, or scroll lock |