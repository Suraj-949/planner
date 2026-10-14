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
| `category` | Presets + Custom (free text ≤ 40) | R-TASK-5 |
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

## 5. What Runs Client-Side, and What Was Moved

Every item in the old version of this table has been resolved. The original pattern — the
client owning state the server should own — is recorded here because it is the defect class
to watch for, not because it still exists.

| Logic | Where it lives now | Note |
|---|---|---|
| Streak | Server — `/api/tasks/streak`, derived from `Task.completedAt` | The localStorage counter (`updateStreak.js`) and the timer route that carried it were deleted |
| Reminder labels | Client — `utils/dates.js` `getReminder` | Same `formatDateKey` the planner and calendar bucket with, so no view can disagree about "today" |
| Completion rate | Server — `/api/tasks/stats`, window-scoped | Lifetime dilution is gone; the analytics page picks the window explicitly |
| Pomodoro state | Client — `localStorage` with an absolute end time | Survives reload; recording sessions server-side is Phase 3.1 |
| Enum option lists | `constants/*.js`, one module per entity | Hand-maintained mirrors of `backend/src/constants/index.js` — still a copy, but one per domain rather than per JSX file |
| Form validation | Server — `entityValidation.js`, whitelist-based | The client shapes the request; the server is the only validator |
| Task list | Server — `/api/tasks/fetch` with filters, sort and pagination | The `seedTasks.js` fallback was deleted; a failed request shows the failure |

---

## 6. Known Gaps

| Gap | Detail |
|---|---|
| No frontend tests | Correctness is guarded by lint and a build check only; `utils/dates.js` is the first thing worth covering |
| Board (kanban) view | Removed rather than left as a dead switch; may return as a real page |
| Time tracking against a task | `actualMinutes` exists on the model and renders on the detail page, but nothing writes it — Phase 3.1 |
| Completion series | `stats.service.js` computes per-day counts but no route exposes them, so the analytics page shows aggregates only |
| Project/goal picker on the task form | The form sets `context`; `projectId` and `goalId` are linked from the project and goal detail pages |