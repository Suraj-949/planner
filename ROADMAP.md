# Planner — Build Roadmap

Complete, phased build plan for evolving Planner from a to-do app into a productivity and
execution platform.

**Structure:** `Goal → Milestone → Project → Task → Subtask`

**Architecture:** modular monolith. React + Vite → Express REST API → MongoDB.
No microservices unless a genuine scalability requirement appears.

---

## Current State

Already built and working — **do not rebuild**:

- JWT auth: access token (15m) + refresh token in httpOnly cookie (7d)
- Axios response interceptor with automatic 401 refresh and request replay
- Express + Mongoose CRUD layers (controller / route / model)
- bcrypt register + login
- Task CRUD with status, priority, category, deadline
- Task update modal, delete action, toasts
- Progress tracker (per-status counts + completion rate)
- Streak counter (`updateStreak.js`, localStorage)
- Derived reminder badges: Overdue / Due Today / Due Tomorrow
- Pomodoro timer (25/5) that survives page reload via stored epoch
- Tailwind CSS 4 + lucide-react + React Router 7

Not yet present: time tracking UI, search/filter, pagination, server-side analytics, habit
tracking UI, database-backed streak.

Present as **schema and validation only** — storage landed in 2.1, the behaviour that uses
it is 2.2 and 2.4: subtasks (embedded in `Task`), `Task` ↔ project/goal links, recurrence
rules, habits and habit completions, and the goal/milestone/project collections.

Also already true, though listed nowhere above: multi-tenancy (`userId` on every owned
document) and an automated test suite (109 tests, `node:test` only).

---

## Guiding Principles

1. **Stay useful at every phase.** Each phase ships something that works. Never build
   scaffolding for a future phase's benefit.
2. **Derive, never store.** Any value computable from other data is computed on read.
3. **Modular monolith.** One deployable backend, organised into domains.
4. **Explicit is better than implicit.** Enum values, roles, and config live in one place.

---

## Phase 1 — Production Foundation

*Make the existing app secure, correct, and deployable. Nothing new is added to the
product surface here — this phase removes the reasons it would fail in production.*

### 1.1 Auth & Token Security ✅ - complete

- ✅ `backend/src/utils/tokens.js` — `type` claim (`access` / `refresh`) on every JWT
- ✅ `verifyAccessToken` / `verifyRefreshToken` reject the wrong token type
- ✅ `POST /auth/logout` clears the refresh cookie
- ✅ Login returns one identical error for unknown-user and bad-password
- ✅ Register validates all fields, normalises email/username, handles unique-index races
- ✅ `password` marked `select: false` with a `toJSON` transform
- ✅ No internal `err.message` in any response body
- ✅ Route the new `logout` handler in `auth.routes.js`
- ✅ Wire rate limiting onto login / register / refresh
- ✅ CSRF protection on the cookie-authenticated refresh route

### 1.2 Server Hardening ✅ - complete

- ✅ Token and header logging removed from `auth.controller.js`
- ✅ Token logging removed from `task.controller.js`
- ✅ Token logging removed from client interceptors
- ✅ Replace hand-rolled CORS block with the `cors` package + `CORS_ORIGINS` allowlist
- ✅ Add `helmet`
- ✅ Add index on `task.userId`
- ✅ Add compound index `{ userId, dateCreated }` to match the sort in `getTasks`

### 1.3 Validation & Error Handling

- ✅ Validators reject `''` instead of treating it as "not provided"
- ✅ `runValidators: true` on the `findOneAndUpdate` update query
- ✅ Genuine database failures return `500`, not `400`
- ✅ Extract task validators into `utils/taskValidation.js` so they are unit-testable
- ✅ Error-handling middleware (4-arg) in `app.js`
- ✅ `404` handler for unmatched routes
- ✅ Adopt a single response envelope across all endpoints

### 1.4 Date Handling

The single highest-value correctness fix. `<input type="date">` submits `YYYY-MM-DD`,
which JavaScript parses as **UTC** midnight, but reminder and streak logic normalise to
**local** midnight. In any timezone behind UTC the date shifts back one day.

- ✅ Server anchors stored deadlines at local noon so no timezone can move the date
- ✅ `formatDateKey` treats `YYYY-MM-DD` as local, not UTC
- ✅ `reminder()` shares the same day-difference helper as the streak logic
- ✅ Extract `utils/dates.js` on the client, used by both streak and reminder

### 1.5 Infrastructure

- ✅ `process.env.PORT` with a `3000` default
- ✅ Graceful shutdown on `SIGINT` / `SIGTERM`
- ✅ Unhandled rejection / uncaught exception guard
- ✅ `start` and `test` scripts in `backend/package.json`
- ✅ `.env.example` for both packages
- ✅ Root `package.json` with npm workspaces + `concurrently` to run both apps
Structured JSON logger replacing `console.log`, with redaction
- ✅ Request ID middleware
- ✅ Seed script with sample data

### 1.6 Client Correctness

- ✅ Failed refresh logs the user out instead of stranding them on a 401 page
- ✅ `AuthProvider` decodes JWT expiry rather than only checking key presence
- ✅ `PrivateRoute` reacts to expiry, not just presence
- ✅ `logout()` calls the new endpoint, then clears local state
- ✅ Delete confirmation dialog
- ✅ Typo `'Commpleted'` → `'Completed'`
- ✅ Invalid Tailwind classes removed: `justify-left`, `gap-2s`, `text-md`
- ✅ Dead `setStreak` state removed from `UpdateTaskModal.jsx`
- ✅ Mid-file `import` moved to the top of `CreateTask.jsx`
- ✅ Catch-all `*` route so unknown URLs do not render a blank page
- ✅ Responsive layout pass

### 1.7 Tests

- ✅ `node:test` suite for task validators
- ✅ Tests for token signing, type separation, and expiry
- ✅ Tests for date normalisation across timezones
- ✅ Tests for auth middleware (valid / missing / malformed / wrong-type tokens)
- ✅ Controller tests with `mongodb-memory-server` (25 tests against a real database)
- ✅ GitHub Actions: lint + test + build + audit, and an image-build smoke test

### 1.8 Deployment

- ✅ Dockerfile for the backend
- ✅ Deployment config (Render / Railway / Fly.io)
- ✅ Environment variable documentation - consolidated table in `backend/docs/ARCHITECTURE.md` §9
- ✅ Production cookie and CORS verification - `npm run verify:deploy`

**Exit criteria:** no secrets logged, no way to replay a refresh token as an access token,
correct deadlines in every timezone, deployable with one command, core logic tested.

---

## Phase 2 — Productivity Core

*This is where Planner stops being a to-do app.*

### 2.1 New Models

✅ **Complete.** Five collections added, Task extended, enums centralised, 109 tests green.

| Model | Key fields |
|---|---|
| `Goal` | title, description, targetDate, status, userId |
| `Milestone` | goalId, title, dueDate, completedAt |
| `Project` | title, description, color, archivedAt, goalId, userId |
| `Subtask` | **resolved: embedded in `Task`**, not its own collection — see below |
| `Habit` | title, cadence, targetPerPeriod, archivedAt, userId |
| `HabitCompletion` | habitId, date, userId |

Extensions to the existing `Task` model:

- `projectId`, `goalId` — links up the hierarchy
- ~~`parentId`~~ — **not needed.** Dropped with the separate-collection decision below
- `recurrence` — object: `{ freq, interval, daysOfWeek }`
- `estimateMinutes`, `actualMinutes` — estimated vs actual
- `tags` — string array
- `notes` — string

**Subtask decision (was open).** Subtasks stay embedded in `Task`. They have no life outside
their task and are never queried on their own, so a collection and a join would buy nothing.
The array position is the identity, so the embedded documents carry `_id: false`. Splitting
later stays cheap because the read path already loads the parent.

**Cross-cutting: shared enums.** The four task enums were previously written out in both
`task.model.js` and `taskValidation.js`, and nothing failed when the copies disagreed — which
is why `runValidators` felt untrustworthy. They now live in `backend/src/constants/index.js`
alongside the new goal, recurrence and habit enums and the length/range limits, and both
layers import it. A test asserts the schema's enums *are* the shared arrays, so a
hand-written copy reintroduced anywhere fails the suite.

**Derived, never stored.** `Goal` has no `progress` field: progress is
`completedMilestones ÷ totalMilestones`, computed on read. Likewise `HabitCompletion` stores
one row per completed day rather than a streak counter, with a unique index on
`{ habitId, date }` so a double-tap cannot inflate a habit's own streak.

Storage and validation only — the services that advance a recurrence, count a streak and
derive goal progress are 2.2.

### 2.2 Backend Services

- `services/recurrence.service.js` — materialise the next occurrence when a recurring
  task is completed; handle missed occurrences
- `services/habit.service.js` — current streak, longest streak, completion rate
- `services/stats.service.js` — dashboard aggregates
- `services/streak.service.js` — **move the streak out of localStorage and into the
  database, scoped per user.** This is the single biggest correctness upgrade in this phase
- `utils/validators.js` — shared, schema-aligned validation

### 2.3 Query Capabilities

- Search across title, description, and notes
- Filter by status, priority, category, tag, project, goal, date range
- Sort by deadline, priority, date created, status
- Pagination — the task list is unbounded today
- Include subtask counts in list responses

### 2.4 Frontend Pages

| Page | Purpose |
|---|---|
| `Dashboard` | Rebuilt — real stats, not lifetime dilution |
| `TaskList` | Search, filter bar, sort control, pagination |
| `TaskDetail` | Subtasks, tags, notes, time estimate vs actual |
| `ProjectList` / `ProjectDetail` | Projects, grouped tasks |
| `GoalList` / `GoalDetail` | Goals → milestones → projects → tasks |
| `Planner` | Weekly and daily planning view |
| `Calendar` | Deadline calendar, month and week |
| `Habits` | Habit list with streak badges |

### 2.5 Frontend Infrastructure

- `layouts/` — authenticated shell with sidebar and header
- `services/` — one API module per domain (`taskService.js`, `goalService.js`)
- `hooks/` — `useTasks`, `useGoals`, `useHabits`, `useDebounce`
- `context/` — auth context already exists; add filter and theme context
- Shared component library extracted from existing duplication: form fields, modal, toast,
  dropdown, stat card, badge, empty state

**Exit criteria:** a user can create a goal, add milestones, attach a project, break it
into tasks and subtasks, plan a week, and see honest progress.

---

## Phase 3 — Focus & Analytics

*Turn recorded activity into insight.*

### 3.1 Focus Sessions

New `FocusSession` model:

- `userId`, `taskId` (optional link)
- `mode` — `focus` | `break`
- `startedAt`, `endedAt`, `durationMinutes`
- `completed` — did the session finish or was it abandoned

Changes:

- ⬜ Rewrite `PomodoroTimer` to persist sessions to the database instead of localStorage
- ⬜ Keep localStorage only for crash recovery, not as the source of truth
- ⬜ Fix inconsistent `isRunning` encodings and the `timeLeft || fallback` bug
- ⬜ Add long-break intervals and a session counter
- ⬜ Link a focus session to a task from the task detail page
- ⬜ Optional sound / browser Notification API on completion

### 3.2 Analytics Service

MongoDB aggregation pipelines for:

- Tasks completed per day / week / month
- Completion rate over time
- Focus minutes per day, by task, by project, by category
- Tasks created vs completed (backlog growth)
- Deadline slippage — planned date vs actual completion
- Productivity by weekday and hour
- Category share of effort

### 3.3 Analytics Frontend

Install `recharts`. Pages:

- `Analytics` — time range selector: 7 days / 30 days / 3 months / 6 months / custom
- `WeeklyReport` — completions, focus time, streak status, deltas vs last week
- `GoalAnalytics` — progress per goal and milestone
- Insight cards — plain-language observations derived from the numbers

**Insight generation must stay explainable.** Every insight has to be traceable to a
computation. No opaque scoring in v1.

**Exit criteria:** a user can see where their time actually went, and whether their
completion rate is improving.

---

## Phase 4 — AI Assistance

*Only after enough structured data exists to ground it. AI assists — it does not replace
the task workflow.*

### 4.1 Prerequisites

- ⬜ LLM provider client with a configured API key
- ⬜ Cost control: per-user token budget, request cap, response caching
- ⬜ Rate limiting per user per feature
- ⬜ Privacy review — user task content leaves the system; needs explicit disclosure
- ⬜ Structured output validation — never trust a model's shape, validate it

### 4.2 Features

| Feature | Input | Output |
|---|---|---|
| Brain dump | Free-form text | Draft task list |
| Task breakdown | One task | Suggested subtasks |
| Daily planning | Today's state | Proposed schedule |
| Prioritisation | Open tasks | Ranked with reasons |
| Deadline risk detection | Deadlines vs workload | Conflict warnings |
| Productivity insights | Aggregated history | Written observations |

### 4.3 Engineering Requirements

- ⬜ Prompt templates per feature, versioned
- ⬜ Response parsing with schema validation and retry
- ⬜ Everything AI suggests is **draft** — user confirms before anything is persisted
- ⬜ Feature flag — AI off by default until validated
- ⬜ Log prompt/response pairs for debugging, with redaction

**Exit criteria:** brain dump produces tasks the user accepts more often than not.

---

## Phase 5 — SaaS & Collaboration

*The point where single-tenant assumptions must be removed.*

### 5.1 Billing

- ⬜ Subscription model: plan, status, current period, cancel date
- ⬜ Plans: Free / Pro / Team — feature entitlements per plan
- ⬜ Payment provider integration with webhook handling
- ⬜ Entitlement middleware gating routes and features by plan
- ⬜ Upgrade / downgrade / cancel flow
- ⬜ Trial handling

### 5.2 Workspaces & Teams

- ⬜ `Workspace` model — the new tenant boundary
- ⬜ `Membership` model — userId, workspaceId, role
- ⬜ Roles: `owner` / `admin` / `member`
- ⬜ **Every existing model gains `workspaceId`.** This is a data migration, not a
    retrofit — plan it before shipping, not after
- ⬜ Switch all queries from `userId` scoping to `workspaceId` scoping
- ⬜ Invite flow with email
- ⬜ Workspace switcher in the UI

### 5.3 Collaboration

- ⬜ Task assignment to members
- ⬜ Comments on tasks with @mentions
- ⬜ Activity feed / audit log
- ⬜ Shared projects and visibility rules
- ⬜ Email notifications for assignment, mention, and due dates

### 5.4 Team Analytics

- ⬜ Team completion rates
- ⬜ Workload distribution across members
- ⬜ Workspace-level trends
- ⬜ Leaderboards (opt-in)

### 5.5 Account & Compliance

- ⬜ Account deletion and data export
- ⬜ Privacy policy and terms acceptance
- ⬜ Session management — list and revoke devices
- ⬜ Refresh token rotation with a server-side revocation list

**Exit criteria:** two users in one workspace can plan a project together, and neither can
read the other's workspace data.

---

## Cross-Cutting

Applies across all phases. Do not defer past Phase 2.

- ⬜ **Root workspace** — one `package.json`, `concurrently` dev script
- ⬜ **Shared enums** — `status`, `priority`, `category` currently declared in five places
    (schema, three validators, two JSX files). Move to one shared module
- ⬜ **Input validation library** — replace hand-rolled validators with zod or joi
- ⬜ **API versioning** — `/api/v1/...`
- ⬜ **OpenAPI docs** — generated from route definitions
- ⬜ **Pagination convention** — consistent `limit` / `offset` / cursor everywhere
- ⬜ **Error envelope** — one shape for all errors, with a machine-readable `code`
- ⬜ **Feature flags** — gate AI, gamification, and SaaS work
- ⬜ **Feature-level tests** — each phase ships with its own test coverage
- ⬜ **CI** — lint, test, build on every push

---

## Open Architecture Decisions

Resolve these before the phase that depends on them. Each one is a fork that is expensive
to reverse later.

| Decision | Options | Needed by | Recommendation |
|---|---|---|---|
| Subtask storage | Embedded array vs own collection | Phase 2 | Embed in `Task`. Simpler queries, subtasks are always read with their parent. Split later if subtasks need independent routing. |
| Recurrence format | Custom `{freq, interval, days}` vs RRULE string | Phase 2 | Custom object. An RRULE parser is a dependency and most users need a fraction of the spec. |
| Streak storage | LocalStorage vs database | Phase 2 | Database, per user. LocalStorage is already wrong across shared devices. |
| Analytics execution | Mongo aggregation pipelines vs app-side JS | Phase 3 | Aggregation pipelines. Data volume will outgrow in-memory processing. |
| Auth scope for Phase 5 | Add `workspaceId` early vs migrate later | Phase 5 | **Add early.** Retrofitting a tenant column across every model and query is the most expensive mistake in this roadmap. |
| AI provider | Managed API vs self-hosted | Phase 4 | Managed API behind a thin interface, so the provider is swappable. |
| Validation library | Zod vs Joi vs hand-rolled | Phase 2 | Zod. Shares types with the TypeScript migration (Phase 6). |

---

## Phase 6 — Deferred (Not Promised)

Not scoped. Revisit only if the product has real users.

- ⬜ TypeScript migration
- ⬜ Offline-first / PWA
- ⬜ Mobile app
- ⬜ Public API and webhooks
- ⬜ Third-party integrations — calendar, Slack, email
- ⬜ Data warehouse / BI export
- ⬜ Internationalisation

---

## Sequencing

```text
Phase 1  Production Foundation      ← nothing else is safe until this lands
    ↓
Phase 2  Productivity Core          ← the product becomes what the vision describes
    ↓
Phase 3  Focus & Analytics          ← activity becomes insight
    ↓
Phase 4  AI Assistance             ← insight becomes suggestion
    ↓
Phase 5  SaaS & Collaboration       ← single user becomes a team
```

Phase 1 is a precondition for everything. Phases 4 and 5 both depend on data that
Phases 2 and 3 produce, which is why they cannot be parallelised.

---

## Rough Effort

Indicative only. Assumes one developer part-time on this.

| Phase | Effort | Risk |
|---|---|---|
| 1 — Production Foundation | 1 week | Low. Well-understood work, no new architecture. |
| 2 — Productivity Core | 3–4 weeks | **High.** New models, queries, and the whole frontend surface. |
| 3 — Focus & Analytics | 2–3 weeks | Medium. Aggregation pipelines need iteration. |
| 4 — AI | 1–2 weeks | Medium. Effort is low, quality tuning is unbounded. |
| 5 — SaaS | 3–4 weeks | **High.** Data migration plus payments. |

The three genuine risks, in order:

1. **Phase 2 scope.** Ten new models, ten new pages, and every existing query changes.
   This is where projects of this shape stall.
2. **Phase 5 migration.** Adding `workspaceId` to every model retroactively touches every
   route, every controller, and every query. Doing it at the end is expensive.
3. **Phase 4 quality.** The code is easy; getting output people actually accept is not.

---

## Definition of Done, Per Phase

A phase is complete when:

- [ ] Every item above is either done or explicitly descoped with a reason
- [ ] The app builds and runs from a clean clone
- [ ] Tests pass
- [ ] Lint passes
- [ ] `.env.example` matches what the code actually reads
- [ ] README reflects the current state, not the intended state
- [ ] The app is still useful to a real user, per the principle above
