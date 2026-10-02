# Backend — Architecture

How the Express API is built. CommonJS, modular monolith, one database.

Related:

- [`../../DOMAIN.md`](../../DOMAIN.md) — shared vocabulary and invariants
- [`BUSINESS-LOGIC.md`](./BUSINESS-LOGIC.md) — server-enforced rules
- [`../../my-app/docs/ARCHITECTURE.md`](../../my-app/docs/ARCHITECTURE.md) — the client
- [`../../README.md`](../../README.md) · [`../../ROADMAP.md`](../../ROADMAP.md)

---

## 1. System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│  CLIENT — React 19 + Vite 8 (SPA)                           │
│  Pages/Routes ──► Components ──► Hooks ──► Axios            │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTPS / JSON
                               │  Authorization: Bearer <access>
                               │  Cookie: refreshToken (httpOnly)
┌──────────────────────────────▼──────────────────────────────┐
│  SERVER — Node.js + Express 5 (modular monolith)            │
│  Middleware ──► Routes ──► Controllers ──► Models           │
│  dotenv ──► process.env                                     │
└──────────────────────────────┬──────────────────────────────┘
                               │  Mongoose driver
┌──────────────────────────────▼──────────────────────────────┐
│  MongoDB — collections: users, tasks (+ goals, habits, …)   │
└─────────────────────────────────────────────────────────────┘
```

**One deployable backend, one static frontend bundle, one database.** No microservices, no
message queue, no shared database between services. A modular monolith is the right shape
at this scale; the boundaries below exist so the code stays navigable and so extracting a
service later stays possible rather than painful.

---

## 2. Repository Layout

```text
backend/
├── server.js                     # process bootstrap, graceful shutdown
├── .env / .env.example
└── src/
    ├── app.js                    # middleware chain + route mounting
    ├── db/
    │   └── db.js                 # mongoose connection + shutdown
    ├── middleware/
    │   ├── auth.middleware.js        # Bearer verification
    │   ├── rateLimit.middleware.js   # auth + API limits
    │   ├── csrf.middleware.js        # origin check on cookie requests
    │   └── requestId.middleware.js   # request correlation
    ├── models/
    ├── controllers/
    ├── routes/
    └── utils/
        ├── tokens.js             # sign/verify, token types
        ├── http.js               # ApiError, asyncHandler
        ├── taskValidation.js     # payload validation, local-noon dates
        ├── response.js           # response envelope
        └── logger.js             # structured, redacting JSON logger
```

---

## 3. Layering

Requests flow strictly downward. A layer may only call the one directly below it.

| Layer | Responsibility | Must NOT |
|---|---|---|
| **Middleware** | Cross-cutting: auth, rate limits, CORS, CSRF, request IDs, parsing | Contain business logic |
| **Routes** | Map method + path to a controller. Declare middleware order | Contain logic or queries |
| **Controllers** | Read/validate input, call a model, shape the response | Contain reusable logic, query Mongo directly for anything non-trivial |
| **Services** ⬜ | Domain logic, multi-model operations, aggregation pipelines | Touch `req` / `res` |
| **Models** | Schema definition, indexes, virtuals, statics | Contain business rules |
| **Utils** | Pure functions with no I/O | Import anything from the rest of the app |

**The controller layer stays thin.** Validation lives in `utils/taskValidation.js`. Services
become necessary in Phase 2, when task creation has to fan out to recurrence materialisation,
streak updates, and activity logging.

### Module Organisation ⬜

Phase 2 reorganises into vertical domain modules:

```text
src/modules/tasks/
├── tasks.routes.js
├── tasks.controller.js
├── tasks.service.js
├── tasks.validators.js
├── task.model.js
└── tasks.test.js
```

Routes still mount centrally in `app.js`, so the public API stays visible in one file while
implementation stays cohesive per domain.

---

## 4. Request Lifecycle

```text
request
  → helmet              security headers
  → cors                origin allowlist, credentials
  → cookies             parses refreshToken
  → express.json()      body parsing (1mb limit)
  → requestId           correlation id, echoed in the response header
  → apiLimiter          300 requests per window
  → /api/health         unauthenticated liveness check
  → csrfGuard           origin verification, cookie-bearing writes only
  → route match
      → authLimiter     10 attempts / 15 min on register + login
      → authMiddleware  verifies Bearer token, sets req.user
      → controller
          → model
      → response
  → 404 handler         unmatched route
  → error handler       converts thrown errors → envelope
```

`app.js` owns this chain and nothing else.

---

## 5. Authentication Flow

```text
REGISTER / LOGIN
  ├─ validate + normalise input
  ├─ bcrypt.compare (or hash on register)
  ├─ sign access token   { id, type: 'access' }  15m
  ├─ sign refresh token  { id, type: 'refresh' }  7d
  ├─ Set-Cookie: refreshToken  httpOnly, secure in prod, sameSite per env
  └─ respond { ok: true, data: { user, accessToken } }

REQUEST TO A PROTECTED ROUTE
  ├─ Authorization: Bearer <access>
  ├─ verifyAccessToken → rejects if type ≠ 'access', expired, or bad signature
  ├─ req.user = decoded.id
  └─ handler

ACCESS TOKEN EXPIRED → 401
  └─ client interceptor POSTs /auth/refresh-token
       ├─ verifyRefreshToken (cookie only, no body)
       ├─ new access token issued, old refresh token reused
       └─ client replays the original request

LOGOUT
  ├─ POST /auth/logout
  └─ Clear-Cookie: refreshToken
```

**Two invariants this design enforces:**

1. A refresh token can never be used as an access token, because `verifyAccessToken`
   rejects any token whose `type` claim is not `access`.
2. `req.user` is only ever set by verified middleware, never from a request body or query
   parameter. Every ownership-scoped query filters on `req.user`.

---

## 6. Response Envelope

Every endpoint returns one shape. The client unwraps it once, in a response interceptor.

```json
{ "ok": true, "data": { "task": { "…": "…" } } }
```

```json
{ "ok": false, "message": "Title is required", "details": ["…"] }
```

| Status | Meaning |
|---|---|
| `400` | Invalid input, with per-field `details` |
| `401` | Missing, malformed, expired, or wrong-type token |
| `403` | Origin rejected by the CSRF guard |
| `404` | Not found, **or** belongs to another user |
| `429` | Rate limit exceeded |
| `500` | Server fault, logged with details and serialised as a generic message |

**A `404` is returned instead of `403` when a resource exists but belongs to another user.**
Returning `403` would confirm the id exists, which is an enumeration vector.

Internal errors are logged server-side and never serialised. The logger redacts token-like
values before writing, satisfying I-9.

---

## 7. CSRF Protection

The refresh token is a cookie, so a cross-site form POST to a cookie-using endpoint would be
sent by the browser automatically. `sameSite: 'lax'` blocks most of these, but that is a
browser policy rather than an application control — older browsers ignore it, and it says
nothing about same-site subresource attacks.

The guard verifies the `Origin` header, falling back to `Referer`. A cross-site attacker can
make a browser *send* a request, but cannot forge the origin it sends from a page they do not
control.

The check runs only when a `refreshToken` cookie is present, so unauthenticated endpoints are
untouched and non-browser API clients keep working. Full rationale is in R-CSRF-1…3.

---

## 8. Data Layer Conventions

- **Ownership scoping** — every query filters on `req.user`; no endpoint accepts a user id
  from the client.
- **Derived over stored** — anything computable is computed on read.
- **Index what you query** — `tasks.userId`, and the compound `{ userId, dateCreated }` that
  backs the list sort.
- **Dates are stored as UTC `Date`.** Deadlines arrive as `YYYY-MM-DD` and are anchored at
  **local noon** on write so no timezone conversion can move the calendar date.
- **Enums are validated centrally** in `taskValidation.js` and declared in `task.model.js`.

---

## 9. Configuration

Environment is validated at boot and fails fast, rather than letting `undefined` reach
`jwt.sign`. `connectDB()` calls `assertEnv()` before opening a connection, so a missing or
undersized `JWT_SECRET` fails at boot rather than on the user's first login.

### Backend

Templates: `backend/.env.example`. Copy to `.env`; both are covered by `.gitignore`.

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | HMAC secret for all tokens, minimum 32 characters |
| `NODE_ENV` | in prod | Drives cookie security flags and log level |
| `PORT` | no | Defaults to `3000`. Injected by most PaaS platforms |
| `HOST` | no | Defaults to `0.0.0.0`. Must stay `0.0.0.0` behind a proxy |
| `CORS_ORIGINS` | in prod | Comma-separated allowlist, also read by the CSRF guard |
| `LOG_LEVEL` | no | `error` \| `warn` \| `info` \| `debug`. Defaults to `info` |
| `SEED_USERNAME` | no | Seed script only. Defaults to `demo` |
| `SEED_EMAIL` | no | Seed script only. Defaults to `demo@planner.local` |
| `SEED_PASSWORD` | no | Seed script only. Defaults to `demo1234` |

### Frontend

Template: `my-app/.env.example`, copied to `.env`. Only `VITE_`-prefixed variables reach
the browser bundle.

| Variable | Purpose |
|---|---|
| `VITE_BASE_BACKEND_URL` | API base URL including the `/api` prefix |

Because Vite inlines `VITE_*` at **build** time, changing this needs a rebuild, not a
restart. Everything else in this table is a secret-free public value by design; secrets
live only in backend variables.

`CORS_ORIGINS` is read in two places — the CORS layer and the CSRF guard. Both resolve it
the same way. Deduplicating that into one module is a reasonable Phase 2 cleanup.

---

## 10. Testing

`npm test` runs `node --test "tests/**/*.test.js"`. 59 tests, no framework dependency —
Node's built-in runner is the only harness.

| File | Tests | Scope |
|---|---|---|
| `tests/taskValidation.test.js` | 21 | Required fields, enums, empty-string enums, trimming, unknown fields, `context`/`estimateMinutes`/`tags`/`subtasks` rules, local-noon anchoring, a 10-timezone rendering matrix |
| `tests/tokens.test.js` | 9 | Signing, expiry, wrong-secret rejection, tampered payload, type separation, access/refresh lifetime ordering |
| `tests/auth.middleware.test.js` | 11 | Missing, malformed, non-Bearer, wrong-type, expired, RFC 7235 case-insensitive scheme, no credential leakage |
| `tests/csrf.test.js` | 8 | Origin and Referer allow/deny, cookie scoping, safe methods, non-browser clients |
| `tests/task.controller.test.js` | 25 | CRUD against a real database, per-user isolation, update-returns-post-image, envelope shape, default values, dashboard-field round-trip, `$unset` clearing |

Controllers run against `mongodb-memory-server`, so the suite needs no external database
and never touches development data.

### Why the suite is written the way it is

Several tests here look fussy about things a status-code assertion would miss, because
each of them corresponds to a defect that shipped:

- The timezone matrix sets `process.env.TZ` across ten real-world offsets. Checking only
  the host timezone passed for months, because the host sits east of UTC where a midnight
  anchor survives. One test asserts the *naive* parse really does shift a day, so the
  matrix cannot silently become vacuous.
- `updateTask returns the document as it is after the change` exists because
  `findOneAndUpdate` defaults to the pre-update document, so the response showed stale data.
- Cross-user tests assert on the database afterwards, not just the HTTP status.

### Known limitation: `runValidators` is unreachable

The controller passes `runValidators: true`, but no test can prove it is doing anything,
and removing it does not fail the suite. That is expected, not an oversight: the validator
and the schema enums are currently identical, so `validateTaskPayload` rejects every bad
value before Mongo is reached. Mutation testing confirms removing the option is invisible.

It is kept as defence in depth — the moment a field is added to the schema without a
matching validator rule, it becomes the only thing stopping a corrupt write. The schema
now mirrors the validator's `maxlength` limits so the two layers agree, and
`the schema enforces the same title limit as the validator` guards that.

Deliberately not covered: authentication flows against a live database, the refresh-token
rotation path, and the rate limiters. Those are Phase 2.

---

## 11. Deployment Topology

```text
┌────────────────┐      ┌─────────────────┐      ┌──────────────┐
│ Static host    │      │ Node host       │─────►│ MongoDB      │
│ (Vercel/Netlify│─────►│ (Render/Railway)│      │ (Atlas)      │
└────────────────┘      └─────────────────┘      └──────────────┘
```

`render.yaml` at the repository root provisions this as a blueprint: a Dockerised Node
API plus a static frontend, with a one-off job for seeding.

### Image

`backend/Dockerfile` is a two-stage build. It must be built from the **repository root**:

```bash
docker build -f backend/Dockerfile -t planner-api .
```

The root is required because npm workspaces resolve every package from the root lockfile.
Building from `backend/` would resolve fresh versions on each build and could drift from
what CI tested. `.dockerignore` sits at the repository root for the same reason — Docker
reads it from the build context, not from the Dockerfile's directory.

The image runs as the unprivileged `node` user, declares a `HEALTHCHECK` against
`/api/health`, and uses exec form so `node` is PID 1 and receives `SIGTERM`, which the
graceful shutdown handler needs in order to close the Mongo connection.

### Production requirements

- `NODE_ENV=production` — enables `secure` cookies and cross-origin `sameSite` settings
- `CORS_ORIGINS` set to the actual frontend host. CORS is never hardcoded.
- `JWT_SECRET` from the platform secret store, never committed
- `MONGO_URI` with IP allowlist enabled on Atlas
- HTTPS terminated at both hosts — the `Secure` cookie flag requires it

### Verifying a deployment

The refresh token is an HTTP-only cookie, and browsers silently drop a `Secure` cookie
sent over plain HTTP. A deployment can therefore pass every local test and still fail
sign-in. `npm run verify:deploy -- <apiUrl> <frontendOrigin>` checks the wire-level
behaviour: health and envelope, that CORS echoes the real origin with credentials allowed,
that an unknown origin is refused, that the cookie is `HttpOnly`/`Secure`/`SameSite=None`
with no `Domain`, and that CSRF blocks a foreign-origin write. It exits non-zero on
failure, so it can gate a deploy.

It inspects headers only. Whether a browser actually *stores* the cookie still needs the
manual check: log in from a real browser, confirm no cookie error in the console, then
hard-reload and confirm the session survives the access token expiring.

---

## 12. Naming Conventions

| Concern | Convention | Example |
|---|---|---|
| Files | kebab-case, singular | `auth.middleware.js` |
| Models | Singular PascalCase | `task.model.js` |
| Handlers | Verb + noun | `createTask`, `getTasks` |
| Boolean fields | `is` / `has` prefix | `isArchived` |
| Constants | `SCREAMING_SNAKE` | `TOKEN_TYPES` |

Fix inconsistencies on touch, not in a sweep.