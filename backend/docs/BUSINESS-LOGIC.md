# Backend — Business Logic

Server-enforced domain rules. Every rule here holds at the API boundary regardless of what
the client sends.

Shared vocabulary, principles, and invariants live in [`../DOMAIN.md`](../DOMAIN.md).
Architecture is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**The backend is authoritative.** Nothing in
[`../frontend/BUSINESS-LOGIC.md`](../frontend/BUSINESS-LOGIC.md) can relax a rule here.

---

## 1. Authentication

| Rule | Detail |
|---|---|
| R-AUTH-1 | Access token expires in **15 minutes** |
| R-AUTH-2 | Refresh token expires in **7 days** |
| R-AUTH-3 | Every token carries `{ id, type }` where `type` ∈ `{ access, refresh }` |
| R-AUTH-4 | A token presented as an access token **must** have `type: 'access'`. Refresh tokens are rejected |
| R-AUTH-5 | `req.user` is set only by verified middleware, never from client input |
| R-AUTH-6 | Every ownership-scoped query filters on `req.user` |
| R-AUTH-7 | Login returns one identical error for unknown account and wrong password |
| R-AUTH-8 | Passwords are stored as bcrypt hashes, cost factor 10, and never selected by default |
| R-AUTH-9 | Register trims `username`, and lowercases `email` before uniqueness checks |
| R-AUTH-10 | Logout clears the refresh cookie. Access tokens already issued remain valid until they expire — that is the documented limit of stateless JWT |
| R-AUTH-11 | Email and username are globally unique. A race is resolved by the unique index, not by a prior `findOne` |
| R-AUTH-12 | Register and login are rate limited. Refresh is deliberately excluded — it fires on a normal page load, so limiting it would lock out legitimate users mid-session |

### CSRF

| Rule | Detail |
|---|---|
| R-CSRF-1 | The refresh token is a cookie, so any state-changing request that carries it is checked for origin |
| R-CSRF-2 | If `Origin` is present it must match `CORS_ORIGINS`. Otherwise `Referer` is checked. Neither present → allowed, since a browser always sends `Origin` on a cross-site POST and `sameSite: 'lax'` is the backstop |
| R-CSRF-3 | The check applies only when a `refreshToken` cookie is actually present, so unauthenticated endpoints and cookie-less API clients are unaffected |

R-CSRF-2's third case is a deliberate tradeoff: blocking it would protect against nothing a
browser can produce, while breaking curl, mobile clients, and proxies that strip the header.

---

## 2. Task

| Rule | Detail |
|---|---|
| R-TASK-1 | `title` is required and must be non-empty after trimming |
| R-TASK-2 | `deadline` is required |
| R-TASK-3 | `status` defaults to `pending`; must be one of the three enum values |
| R-TASK-4 | `priority` defaults to `medium`; must be `high`, `medium`, or `low` |
| R-TASK-5 | `category` defaults to `other`; must be one of the six enum values |
| R-TASK-6 | `userId` is taken from the token, never from the request body |
| R-TASK-7 | An omitted optional field is left unchanged on update; an empty string is **rejected**, not treated as absent |
| R-TASK-8 | Enum validation runs on both `save()` and `findOneAndUpdate` (`runValidators: true`) |
| R-TASK-9 | A task belonging to another user returns `404`, not `403` |
| R-TASK-10 | Deletion is permanent. There is no soft delete in v1 |
| R-TASK-11 | An unknown field is rejected rather than silently dropped, so a typo cannot look like a successful write |

---

## 3. Dates & Timezones

**This is the highest-risk area in the codebase.** The rule is unintuitive and will be
accidentally reverted otherwise.

| Rule | Detail |
|---|---|
| R-DATE-1 | `<input type="date">` submits `YYYY-MM-DD`, which JavaScript parses as **UTC** midnight |
| R-DATE-2 | Deadlines are stored anchored at **local noon** on the submitted calendar date |
| R-DATE-3 | Noon anchors a date-based value so no timezone conversion — server or client — can shift it across a day boundary |
| R-DATE-4 | Day comparisons operate on **local** calendar days, never UTC days |
| R-DATE-5 | `YYYY-MM-DD` strings are parsed as **local** dates, never `new Date(string)` |
| R-DATE-6 | Day differences are computed as whole local days, not as `millisecond / 86400000` across offsets |
| R-DATE-7 | `dateCreated` is a true instant and stays UTC. Only deadlines get the noon anchor |

**Why noon:** storing midnight means the instant sits exactly on a day boundary, so a user
in UTC−5 viewing it as local time sees the previous day. Noon sits in the middle of the
day, so every timezone from UTC−12 to UTC+12 still lands on the same calendar date.

**Verified.** A deadline of `2026-10-26` stored on a UTC+5:30 server reads back as
`06:30Z` — local noon — confirming the anchor survives the round trip.

---

## 4. Streak

Server-side streak is Phase 2. The rules are recorded now so the code does not invent them
by accident.

| Rule | Detail |
|---|---|
| R-STREAK-1 | A streak increments **only** on a genuine transition into `completed` |
| R-STREAK-2 | Re-saving a task that is already `completed` does **not** increment. Transition is `oldStatus !== 'completed' && newStatus === 'completed'` |
| R-STREAK-3 | Completing a second task on the same day does **not** increment. One day can count once |
| R-STREAK-4 | Last completion was exactly yesterday → increment |
| R-STREAK-5 | Last completion was 2+ days ago → reset to `1` |
| R-STREAK-6 | Clock skew producing a negative gap → reset to `1`, never decrement |
| R-STREAK-7 | Streak state is **per user** and lives in the database ⬜ Phase 2 |
| R-STREAK-8 | Un-completing a task does **not** decrement the streak. A streak measures days active, not current status |

**Currently the streak lives in `localStorage` on the client.** That violates R-STREAK-7
outright — it is not scoped to a user, so two people sharing a browser inherit each other's
streak, and it survives logout. Moving it server-side is a Phase 2 item.

---

## 5. Progress & Statistics

| Rule | Detail |
|---|---|
| R-STAT-1 | Completion rate = `completed ÷ total × 100`, rounded to an integer |
| R-STAT-2 | An empty task list yields `0`, not `NaN` |
| R-STAT-3 | Status buckets are exactly `completed`, `in-progress`, `pending` |
| R-STAT-4 | A task with a status outside the enum belongs to no bucket and is excluded rather than silently counted as pending |
| R-STAT-5 | The current dashboard computes over **all** tasks with no date window, so it is a lifetime figure ⬜ Phase 2 will add period scoping |

R-STAT-4 is a direct consequence of the `runValidators` hole fixed in Phase 1 — while it
existed, invalid statuses could reach the database and vanish from every aggregate.

---

## 6. Reminders & Overdue

| Rule | Detail |
|---|---|
| R-REM-1 | Days remaining = local day difference from today to deadline |
| R-REM-2 | `< 0` → **Overdue** |
| R-REM-3 | `= 0` → **Due Today** |
| R-REM-4 | `= 1` → **Due Tomorrow** |
| R-REM-5 | Reminders are suppressed entirely when `status === 'completed'` |
| R-REM-6 | A completed task is never labelled Overdue, even with a long-past deadline |
| R-REM-7 | Reminders are **display-only**. They are not notifications and do not use the Notification API ⬜ Phase 2 |

---

## 7. ⬜ Phase 2 Rules

Introduced with their respective models. Recorded here so the rules are decided before the
code forces decisions.

| Rule | Domain | Statement |
|---|---|---|
| R-RECUR-1 | Recurring tasks | Completing a recurring task creates the next occurrence with an advanced deadline |
| R-RECUR-2 | Recurring tasks | Missed occurrences collapse into one instance, never a backlog of stale duplicates |
| R-SUB-1 | Subtasks | A task is `completed` only when its subtasks are all complete, unless explicitly overridden |
| R-HAB-1 | Habits | A habit's streak counts consecutive *scheduled* occurrences met, not consecutive calendar days |
| R-HAB-2 | Habits | A habit with cadence "3× per week" is not broken by a missed Monday |
| R-FOCUS-10 | Focus | A focus session with no task link still counts toward total time but not toward task effort |
| R-RANK-1 | Scoring ⬜ | Rank is 1 + count of strictly higher scores. Ties share a rank |
| R-GOAL-1 | Goals | A goal's progress is the percentage of its milestones completed, not its tasks |
| R-ENTITLE-1 | Billing ⬜ | Plan limits are enforced server-side. The client hides features but never gates them |