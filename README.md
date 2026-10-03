# Planner — Task Management App

A full-stack task planner with authentication, task CRUD, progress tracking, streaks, and
a Pomodoro timer. Built as a two-package repo: an Express + MongoDB REST API and a
React single-page client.

> **Status note**
> The codebase is a to-do app. It is planned to grow into a productivity and execution
> platform — see [`ROADMAP.md`](./ROADMAP.md). Nothing in the roadmap has been implemented
> yet beyond the Phase 1 security and correctness work. This README documents the code that
> actually exists.

## Documentation

Documentation is split by the area it describes, so each file has one audience and one owner.

| Document | Contents |
|---|---|
| [`README.md`](./README.md) | This file — current state, setup, API, models, known issues |
| [`ROADMAP.md`](./ROADMAP.md) | Five-phase build plan |
| [`DOMAIN.md`](./DOMAIN.md) | Shared glossary, derive-never-store principle, enums, invariants |
| [`backend/docs/ARCHITECTURE.md`](./backend/docs/ARCHITECTURE.md) | Express layering, request lifecycle, auth flow, envelope, deployment |
| [`backend/docs/BUSINESS-LOGIC.md`](./backend/docs/BUSINESS-LOGIC.md) | Server-enforced rules: auth, tasks, dates, validation |
| [`my-app/docs/ARCHITECTURE.md`](./my-app/docs/ARCHITECTURE.md) | React layering, axios layer, state, routing, design system |
| [`my-app/docs/BUSINESS-LOGIC.md`](./my-app/docs/BUSINESS-LOGIC.md) | Client validation parity, auth state, rendering rules, known gaps |

**Start here:**

| You are | Read |
|---|---|
| Working on the API, models, or middleware | `backend/docs/ARCHITECTURE.md` |
| Writing a controller or validator | `backend/docs/BUSINESS-LOGIC.md` |
| Working on components, routing, or state | `my-app/docs/ARCHITECTURE.md` |
| Building a form or a view | `my-app/docs/BUSINESS-LOGIC.md` |
| Unsure what a term means | `DOMAIN.md` |

**The backend is authoritative.** Every rule described as "server-enforced" holds at the API
boundary regardless of what the client sends. The split makes that visible in the structure:
`backend/docs/BUSINESS-LOGIC.md` documents what the server guarantees,
`my-app/docs/BUSINESS-LOGIC.md` documents what the client mirrors for fast feedback and where
that mirror currently disagrees.

**Why `DOMAIN.md` is separate.** The glossary, the derive-never-store principle, the enum
values, and the invariants apply to both sides. Restating them in a backend file and a
frontend file guarantees they drift, which is the exact failure these documents exist to
prevent. So they live once, and both sides link to them.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, Axios, lucide-react |
| Backend | Node.js, Express 5, Mongoose 9, jsonwebtoken, bcrypt, cookie-parser, dotenv, cors, helmet, express-rate-limit |
| Database | MongoDB |
| Auth | JWT access token in `localStorage` + refresh token in an httpOnly cookie |

Two separate npm packages, no monorepo tooling and no root `package.json` yet.

---

## 📁 Project Structure

```text
planner/
├── package.json                   # npm workspaces + dev/build/seed/verify scripts
├── package-lock.json
├── .gitignore
├── .dockerignore                  # Read from the build context (repo root)
├── render.yaml                    # Render blueprint: API + static frontend + seed job
├── README.md
├── ROADMAP.md
├── DOMAIN.md                      # Shared glossary, principles, enums, invariants
├── .github/workflows/ci.yml       # Lint, test, build, audit, image build
│
├── backend/                       # Express REST API (CommonJS)
│   ├── server.js                  # Entry point — connects DB, listens on PORT
│   ├── Dockerfile                 # Two-stage build; build from the repo root
│   ├── .env / .env.example        # gitignored / committed
│   ├── docs/                      # Backend architecture + business rules
│   │   ├── ARCHITECTURE.md
│   │   └── BUSINESS-LOGIC.md
│   ├── tests/                     # node:test suite — npm test
│   │   ├── taskValidation.test.js
│   │   ├── tokens.test.js
│   │   ├── auth.middleware.test.js
│   │   ├── csrf.test.js
│   │   ├── task.controller.test.js  # runs against an in-memory MongoDB
│   │   └── phase2Models.test.js     # Phase 2 schema contracts + index declarations
│   └── src/
│       ├── app.js                # Middleware chain + route mounting
│       ├── db/
│       │   └── db.js             # mongoose.connect wrapper + env validation
│       ├── constants/
│       │   └── index.js          # shared enums + limits, imported by the models and
│       │                         # the validators so the two layers cannot drift
│       ├── utils/
│       │   ├── tokens.js         # JWT sign/verify, access vs refresh type separation, cookies
│       │   ├── taskValidation.js  # Payload rules + local-noon deadline parsing
│       │   ├── response.js       # { ok, data } envelope helpers
│       │   ├── http.js           # ApiError + asyncHandler
│       │   └── logger.js         # Structured JSON logger with redaction
│       ├── models/
│       │   ├── user.model.js     # User schema
│       │   ├── task.model.js     # Task schema + embedded subtasks/recurrence + indexes
│       │   ├── goal.model.js     # Goal — progress is derived, never stored
│       │   ├── milestone.model.js# Milestone — reaches its owner via goalId
│       │   ├── project.model.js  # Project — colour, archive timestamp, optional goal
│       │   ├── habit.model.js    # Habit — cadence + target-per-period
│       │   └── habitCompletion.model.js  # One row per habit per day
│       ├── controllers/
│       │   ├── auth.controller.js    # register, login, refreshToken, logout
│       │   └── task.controller.js    # create, fetch, update, delete
│       ├── routes/
│       │   ├── auth.routes.js    # /api/auth/*
│       │   └── task.routes.js    # /api/tasks/*
│       ├── middleware/
│       │   ├── auth.middleware.js     # Bearer token → req.user (RFC 7235 scheme)
│       │   ├── rateLimit.middleware.js# auth + API limits
│       │   ├── csrf.middleware.js    # origin check on cookie requests
│       │   └── requestId.middleware.js# request correlation
│       └── scripts/
│           ├── seed.js           # npm run seed — idempotent demo data
│           └── verify-deploy.js  # npm run verify:deploy — post-deploy header checks
│
└── my-app/                       # React client (ESM)
    ├── .env / .env.example
    ├── vite.config.js            # react + @tailwindcss/vite plugins
    ├── docs/                     # Frontend architecture + business rules
    │   ├── ARCHITECTURE.md
    │   └── BUSINESS-LOGIC.md
    └── src/
        ├── main.jsx              # BrowserRouter + AuthProvider
        ├── App.jsx               # Route definitions
        ├── AuthProvider.jsx      # Auth context, backed by token expiry
        ├── PrivateRoute.jsx      # Client-side route guard
        ├── axiosInstance.js      # Axios + auth/refresh interceptors + envelope unwrap
        ├── index.css             # @import "tailwindcss" + @theme design tokens
        ├── context/AuthContext.js # Context object, split from the provider
        ├── hooks/useAuth.js      # Consumer hook for auth state
        ├── constants/
        │   ├── navigation.js     # Sidebar nav items
        │   └── taskMeta.js       # Enums, labels, colour variants
        ├── pages/
        │   ├── TasksPage.jsx     # Main dashboard
        │   └── NotFound.jsx
        ├── components/
        │   ├── layout/           # Sidebar, Header
        │   ├── tasks/            # Filters, TaskList, TaskRow, CreateTaskPanel
        │   ├── ui/               # Badge, Button, Input, Label, Checkbox
        │   ├── Register.jsx        # Combined sign-up / login screen
        │   ├── CreateTask.jsx      # Create form + progress tracker + streak card
        │   ├── FetchTask.jsx       # Task list, reminders, stats, delete
        │   ├── UpdateTaskModal.jsx # Full-task edit modal
        │   └── PomodoroTimer.jsx   # 25/5 timer, survives page reload
        ├── data/seedTasks.js      # Dashboard seed content
        └── utils/
            ├── dates.js          # Local date parsing + shared formatDateKey
            └── jwt.js            # Decode exp claim
```

---

## ⚙️ Setup

### Prerequisites

* Node.js 20+
* A running MongoDB instance (local or Atlas)

### Install

This is an npm-workspaces repository, so install **once at the root** rather than in each
package:

```bash
npm install
```

### Configure

Two files, both gitignored. Copy the templates:

```bash
cp backend/.env.example backend/.env
cp my-app/.env.example my-app/.env
```

`backend/.env` needs at least:

```env
MONGO_URI=mongodb://127.0.0.1:27017/planner
JWT_SECRET=your-long-random-secret-at-least-32-chars
```

Generate a suitable secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`my-app/.env` needs:

```env
VITE_BASE_BACKEND_URL=http://localhost:3000/api
```

Full variable reference: `backend/docs/ARCHITECTURE.md` §9.

### Run

```bash
npm run dev      # API on :3000 and Vite on :5173, together
```

Individually:

```bash
npm run dev:api  # backend only
npm run dev:web  # frontend only
```

Vite serves on **5173**, which must be listed in `CORS_ORIGINS` on the backend. Both
`http://localhost:5173` and `http://127.0.0.1:5173` are needed — a browser treats them as
different origins.

### Seed demo data

```bash
npm run seed
```

Creates a `demo` user and a spread of tasks, and prints the credentials. It replaces that
user's tasks on each run rather than duplicating them. Point `MONGO_URI` somewhere you do
not mind before running it.

### Verify

```bash
npm run verify    # lint + test + build
```

The backend suite needs no database — controllers run against an in-memory MongoDB.

---

## 🔐 Authentication

| Token | Lifetime | Storage | Transport |
|---|---|---|---|
| Access | 15 minutes | `localStorage.accessToken` | `Authorization: Bearer <token>` |
| Refresh | 7 days | `refreshToken` cookie (httpOnly) | Sent automatically with credentials |

Every token carries a `type` claim (`access` or `refresh`). `verifyAccessToken` rejects a
refresh token, so a stolen refresh cookie cannot be replayed as an access token.

**Sign-in** accepts either a username or an email, and returns one identical error for an
unknown account and a wrong password so the endpoint cannot be used to enumerate accounts.

**Automatic refresh** is handled by the Axios response interceptor: on a `401` it calls
`/auth/refresh-token`, stores the new access token, patches the original request header,
and replays it. A `retry` flag prevents an infinite loop. If the refresh itself fails the
client clears the token and returns to the sign-in screen.

**Logout** calls `POST /auth/logout`, which clears the refresh cookie, then clears local
state. Access tokens already issued remain valid until they expire — the documented limit
of stateless JWT.

**Route guarding** is client-side only and checks token expiry from the JWT `exp` claim.
The server middleware remains the actual security boundary.

---

## 🔌 API Reference

Base URL: `http://localhost:3000/api`

### Auth

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password }` | `201` `{ message, user, accessToken }` + refresh cookie |
| POST | `/auth/login` | `{ username, password }` | `200` `{ message, user, accessToken }` + refresh cookie |
| POST | `/auth/refresh-token` | — (cookie only) | `200` `{ message, accessToken }` |
| POST | `/auth/logout` | — | `200` `{ message }`, clears refresh cookie |

### Tasks — all four require a Bearer token

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/tasks/create` | `{ title*, description, status?, deadline*, category?, priority? }` | `201` `{ message, task }` |
| GET | `/tasks/fetch` | — | `200` `{ message, tasks[] }`, newest first |
| PUT | `/tasks/update/:id` | `{ title*, deadline*, description?, status?, category?, priority? }` | `200` `{ message, task }` |
| DELETE | `/tasks/delete/:id` | — | `200` `{ message, task }` |

Queries are scoped per user from the verified token — no endpoint accepts a user id from
the client. A task belonging to another user returns `404`.

---

## 🗄️ Data Models

### User — `backend/src/models/user.model.js`

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | String | yes | unique, trimmed |
| `email` | String | yes | unique, trimmed, lowercased |
| `password` | String | yes | bcrypt hash, `select: false` — never returned |

### Task — `backend/src/models/task.model.js`

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `title` | String | yes | — | ≤ 200 chars |
| `description` | String | no | — | ≤ 5000 chars |
| `status` | String | no | `pending` | `pending` \| `in-progress` \| `completed` |
| `deadline` | Date | yes | — | anchored at local noon — see BUSINESS-LOGIC §3.3 |
| `category` | String | no | `other` | `DSA` \| `development` \| `college` \| `personal` \| `work` \| `other` |
| `priority` | String | no | `medium` | `high` \| `medium` \| `low` |
| `context` | String | no | — | project name, no default |
| `projectId` | ObjectId → `Project` | no | — | unset by default |
| `goalId` | ObjectId → `Goal` | no | — | denormalised from the project |
| `recurrence` | Subdocument | no | — | `{ freq, interval, daysOfWeek }`, absent when not recurring |
| `estimateMinutes` | Number | no | — | whole minutes, `0…1440` |
| `actualMinutes` | Number | no | — | whole minutes, `0…43200` |
| `tags` | String[] | no | — | trimmed, lowercased, de-duplicated |
| `notes` | String | no | — | ≤ 2000 chars |
| `subtasks` | Subdocument[] | no | — | embedded, `_id: false` |
| `dateCreated` | Date | no | `Date.now` | true instant, stored UTC |
| `userId` | ObjectId → `User` | yes | — | from the token |

Every enum and length limit above is declared once in `backend/src/constants/index.js` and
imported by both `task.model.js` and `utils/taskValidation.js`. They used to be written out
in five places — the schema, three validators, and two `<select>` dropdowns — and nothing
failed when the copies disagreed, which is why `runValidators` felt untrustworthy. A test
now asserts the schema's enums *are* the shared arrays.

The `<select>` dropdowns still hardcode their own options; they read from the API's task
metadata instead once 2.2 exposes it.

### Goal — `backend/src/models/goal.model.js`

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `title` | String | yes | — | ≤ 200 chars |
| `description` | String | no | — | ≤ 5000 chars |
| `targetDate` | Date | no | — | — |
| `status` | String | no | `active` | `active` \| `completed` \| `abandoned` |
| `userId` | ObjectId → `User` | yes | — | — |

**There is no `progress` field.** Progress is `completedMilestones ÷ totalMilestones`,
computed on read — a stored number would be a second source of truth free to disagree with
the milestones it came from. A test asserts the path does not exist.

### Milestone — `backend/src/models/milestone.model.js`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `goalId` | ObjectId → `Goal` | yes | — |
| `title` | String | yes | ≤ 200 chars |
| `dueDate` | Date | no | — |
| `completedAt` | Date | no | unset means open |

No `userId`: a milestone reaches its owner through `goalId`. Tenancy lives in exactly one
place per document.

### Project — `backend/src/models/project.model.js`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | String | yes | ≤ 200 chars |
| `description` | String | no | ≤ 5000 chars |
| `color` | String | no | six-digit hex, `#rrggbb` — no default |
| `archivedAt` | Date | no | unset means active |
| `goalId` | ObjectId → `Goal` | no | — |
| `userId` | ObjectId → `User` | yes | — |

### Habit — `backend/src/models/habit.model.js`

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `title` | String | yes | — | ≤ 200 chars |
| `cadence` | String | no | `daily` | `daily` \| `weekly` \| `monthly` |
| `targetPerPeriod` | Number | no | `1` | `1…31` — 31 is the most days a monthly period has |
| `archivedAt` | Date | no | — | — |
| `userId` | ObjectId → `User` | yes | — | — |

### HabitCompletion — `backend/src/models/habitCompletion.model.js`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `habitId` | ObjectId → `Habit` | yes | — |
| `date` | Date | yes | local calendar date, anchored at local noon |
| `userId` | ObjectId → `User` | yes | denormalised so a streak query needs no join |

**Unique index on `{ habitId, date }`.** One row per habit per day, and the database refuses
a second — otherwise a double-tap stores two rows and the habit's own streak counts both.
Un-ticking a day means deleting a row, which is correct by construction; a stored counter
would need decrement logic that can be wrong.

> Storage and validation only. Advancing a recurrence, counting a streak and deriving goal
> progress arrive with the 2.2 services — none of these rules run yet.

---

## ✨ Features

### Authentication
`Register.jsx` is one component toggling between sign-up and login, with a password
visibility toggle, submit spinner, and error display.

### Task management
Full CRUD. `CreateTask.jsx` is the de-facto dashboard holding the create form, progress
card, and streak card. `FetchTask.jsx` renders the list and handles delete. Deletion
requires confirmation.

### Progress tracker
Stats are computed from the fetched tasks and passed up via `onStatsChange`. Four counters
— total, completed, in-progress, pending — plus a completion-rate bar.

> The completion rate currently spans **all** tasks with no date window, so it is a
> lifetime figure that can only ever dilute. Period scoping is a Phase 2 item.

### Streak
`updateStreak.js` increments a counter when a task transitions into `completed`, using
local-time day keys. Same-day repeats are a no-op, so completing several tasks in one day
counts once. Re-saving an already-completed task does not increment.

> The streak lives **only in `localStorage`** — not in the database, not scoped per user,
> and never cleared on logout. Two people sharing a browser inherit each other's streak.
> Moving it server-side is a Phase 2 item.

### Reminders
Derived badges on each task card, computed from the whole-day difference between the
deadline and today: `< 0` Overdue, `= 0` Due Today, `= 1` Due Tomorrow. Suppressed for
completed tasks. Display-only — no browser notifications.

### Pomodoro timer
A 25-minute focus / 5-minute break timer at `/timer`. State lives in `localStorage` and an
absolute `endTime` epoch means a reload mid-session resumes with the correct remaining time.

### Toasts
Create, update, and delete each surface a banner that auto-clears after three seconds.

---

## 🖥️ Routes

| Path | Guard | Component |
|---|---|---|
| `/` | none | `Register` — doubles as login |
| `/create-task` | `PrivateRoute` | `CreateTask` |
| `/timer` | `PrivateRoute` | `PomodoroTimer` |
| `*` | none | NotFound |

---

## ⚠️ Known Issues

Full detail in [`DOMAIN.md` §5](./DOMAIN.md) and
[`ROADMAP.md` Phase 1](./ROADMAP.md).

**Resolved in Phase 1**

- Access and refresh tokens are now distinguishable via a `type` claim
- Logout endpoint clears the refresh cookie
- Password hashes are `select: false` with a `toJSON` transform
- Login no longer enumerates accounts
- Internal errors are no longer leaked to clients
- Deadlines no longer shift a day in negative UTC offsets
- Enum values can no longer be persisted as empty strings

**Open**

- No server-side refresh-token revocation — a stolen access token is valid until it expires
- No refresh token rotation or reuse detection
- Streak and progress statistics are client-side only
- No pagination — the task list is unbounded
- No tests for controllers
- No `helmet` or rate limiting on auth routes
- Deadline storage uses a noon anchor rather than a dedicated date type
- Hardcoded CORS origin — not deployable to another frontend host without editing source

---

## 📄 License

ISC
