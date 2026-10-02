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
├── README.md
├── ROADMAP.md
├── DOMAIN.md                      # Shared glossary, principles, enums, invariants
│
├── backend/                      # Express REST API (CommonJS)
│   ├── server.js                 # Entry point — connects DB, listens on PORT
│   ├── .env / .env.example      # gitignored / committed
│   ├── docs/                     # Backend architecture + business rules
│   │   ├── ARCHITECTURE.md
│   │   └── BUSINESS-LOGIC.md
│   └── src/
│       ├── app.js                # Middleware chain + route mounting
│       ├── db/
│       │   └── db.js             # mongoose.connect wrapper + shutdown
│       ├── utils/
│       │   ├── tokens.js         # JWT sign/verify, access vs refresh type separation
│       │   ├── taskValidation.js  # Payload rules + local-noon deadline parsing
│       │   ├── response.js       # { ok, data } envelope helpers
│       │   └── logger.js         # Structured JSON logger with redaction
│       ├── models/
│       │   ├── user.model.js     # User schema
│       │   └── task.model.js     # Task schema + indexes
│       ├── controllers/
│       │   ├── auth.controller.js    # register, login, refreshToken, logout
│       │   └── task.controller.js    # create, fetch, update, delete
│       ├── routes/
│       │   ├── auth.routes.js    # /api/auth/*
│       │   └── task.routes.js    # /api/tasks/*
│       ├── middleware/
│       │   ├── auth.middleware.js     # Bearer token → req.user
│       │   ├── rateLimit.middleware.js# auth + API limits
│       │   ├── csrf.middleware.js    # origin check on cookie requests
│       │   └── requestId.middleware.js# request correlation
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

* Node.js 18+
* A running MongoDB instance (local or Atlas)

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` — see `backend/.env.example` for the full list:

```env
MONGO_URI=mongodb://127.0.0.1:27017/planner
JWT_SECRET=your-long-random-secret
```

Run:

```bash
npm start          # node server.js
```

Defaults to port **3000**, override with `PORT`.

### 2. Client

```bash
cd my-app
npm install
```

Create `my-app/.env`:

```env
VITE_BASE_BACKEND_URL=http://localhost:3000/api
```

Run:

```bash
npm run dev
```

Vite serves on **5173**, which must be listed in `CLIENT_ORIGIN` on the backend.

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
| `title` | String | yes | — | — |
| `description` | String | no | — | — |
| `status` | String | no | `pending` | `pending` \| `in-progress` \| `completed` |
| `deadline` | Date | yes | — | anchored at local noon — see BUSINESS-LOGIC §3.3 |
| `category` | String | no | `other` | `DSA` \| `development` \| `college` \| `personal` \| `work` \| `other` |
| `priority` | String | no | `medium` | `high` \| `medium` \| `low` |
| `dateCreated` | Date | no | `Date.now` | true instant, stored UTC |
| `userId` | ObjectId → `User` | yes | — | from the token |

Enum values are currently declared in five places — the schema, three validators in
`task.controller.js`, and the `<select>` dropdowns in two components. Collapsing these into
one shared constants module is a Phase 2 item.

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
