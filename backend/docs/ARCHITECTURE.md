# Backend — Architecture

How the Express API is built. CommonJS, modular monolith, one database.

Related:

- [`../DOMAIN.md`](../DOMAIN.md) — shared vocabulary and invariants
- [`BUSINESS-LOGIC.md`](./BUSINESS-LOGIC.md) — server-enforced rules
- [`../frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md) — the client
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
`jwt.sign`.

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | HMAC secret for all tokens, minimum 32 characters |
| `NODE_ENV` | in prod | Drives cookie security flags and log level |
| `PORT` | no | Defaults to `3000` |
| `HOST` | no | Defaults to `0.0.0.0` |
| `CORS_ORIGINS` | in prod | Comma-separated allowlist, also read by the CSRF guard |
| `LOG_LEVEL` | no | Defaults to `info` outside production |

`CORS_ORIGINS` is read in two places — the CORS layer and the CSRF guard. Both resolve it
the same way. Deduplicating that into one module is a reasonable Phase 2 cleanup.

---

## 10. Testing

Pure unit tests via `node:test`. No database or dev server required.

| File | Scope |
|---|---|
| `tests/taskValidation.test.js` | Required fields, enums, trimming, unknown fields, local-noon anchoring |
| `tests/tokens.test.js` | Signing, expiry, wrong-secret rejection, token-type separation |
| `tests/auth.middleware.test.js` | Valid, missing, malformed, wrong-type, expired tokens |
| `tests/csrf.test.js` | Origin and Referer allow/deny, cookie scoping, non-browser clients |

Run with `npm test`. **26 tests, all passing.**

Not yet covered: controllers against a real request, and any live-database integration. Those
are Phase 2 and should use `supertest` with `mongodb-memory-server`, or mocked models if the
binary download is unacceptable in CI.

---

## 11. Deployment Topology

```text
┌────────────────┐      ┌─────────────────┐      ┌──────────────┐
│ Static host    │      │ Node host       │      │ MongoDB      │
│ (Vercel/Netlify│─────►│ (Render/Railway)│─────►│ (Atlas)      │
└────────────────┘      └─────────────────┘      └──────────────┘
```

Production requirements:

- `NODE_ENV=production` — enables `secure` cookies and cross-origin `sameSite` settings
- `CORS_ORIGINS` set to the actual frontend host. CORS is never hardcoded.
- `JWT_SECRET` from the platform secret store, never committed
- `MONGO_URI` with IP allowlist enabled on Atlas
- HTTPS terminated at both hosts — the `Secure` cookie flag requires it

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