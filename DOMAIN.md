# Planner — Domain

Vocabulary, principles, and invariants shared by both sides of the application.

This is the **canonical** copy. [`backend/BUSINESS-LOGIC.md`](./backend/BUSINESS-LOGIC.md)
and [`frontend/BUSINESS-LOGIC.md`](./frontend/BUSINESS-LOGIC.md) link here rather than
restating these, so the two cannot disagree.

Related:

- [`../README.md`](../README.md) — documentation index and project state
- [`backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md) — how the API is built
- [`frontend/ARCHITECTURE.md`](./frontend/ARCHITECTURE.md) — how the SPA is built
- [`../ROADMAP.md`](../ROADMAP.md) — phased build plan

---

## 1. Glossary

| Term | Meaning |
|---|---|
| **Task** | A unit of work with a title, status, priority, category, and deadline |
| **Status** | Lifecycle state: `pending` → `in-progress` → `completed` |
| **Priority** | Urgency: `high`, `medium`, `low` |
| **Category** | Domain grouping of a task |
| **Deadline** | The calendar date by which a task should be finished. Not a completion timestamp |
| **Streak** | Consecutive days on which at least one task transitioned to `completed` |
| **Focus session** | A completed Pomodoro interval, with a duration and optional task link |
| **Goal** ⬜ | Long-term objective; owns milestones, which own projects, which own tasks |
| **Habit** ⬜ | A recurring behaviour tracked separately from tasks |
| **Overdue** | Deadline is earlier than today and the task is not `completed` |

**Tasks vs habits — the distinction is intentional.** A task is something you must finish
once. A habit is something you must do repeatedly. They share streak mechanics but not
semantics: completing a task is an event, completing a habit is a scheduled occurrence.
Habits are Phase 2.

---

## 2. Core Principle — Derive, Never Store

> If a value can be computed from other data, it is computed on read.

| Never stored | Derived from |
|---|---|
| `completionRate` | Count of `completed` ÷ total tasks |
| `streak` | Consecutive-day history of status transitions |
| `isOverdue` | Deadline vs today, filtered on status |
| `daysRemaining` | `deadline` − today |
| `taskCounts` | `group by status` |
| `rank` ⬜ | Sort scores within an exam |
| `progress` ⬜ | Completed milestones ÷ total milestones |
| `actualMinutes` ⬜ | Sum of focus sessions linked to the task |

**Why this matters.** A stored counter drifts the moment any code path misses an update —
a manual status change, a concurrent edit, a failed write. Once two sources of truth
disagree, every report built on them is wrong and nobody can tell which one to trust. The
only structural defence is to not have a second source.

**Exception:** `FocusSession.durationMinutes` *is* stored, because it is captured at record
time and cannot be reconstructed — the timer is not replayable. It is a measurement, not a
rollup.

---

## 3. Enum Reference

```text
status     : pending | in-progress | completed
priority   : high | medium | low
category   : DSA | development | college | personal | work | other
```

**Server side** these are enforced by `backend/src/utils/taskValidation.js` and declared in
`backend/src/models/task.model.js`.

**Client side** the option lists live in `my-app/src/constants/taskMeta.js`. The backend
schema remains the source of truth; the client module is a mirror, not an independent
declaration.

---

## 4. Invariants

Statements that must be true of the system at all times. Any change that breaks one is a
regression regardless of whether tests pass.

| # | Invariant | Enforced by |
|---|---|---|
| I-1 | No user can read or modify another user's tasks | server |
| I-2 | A refresh token cannot authorise an API request | server |
| I-3 | A password hash never appears in any response body | server |
| I-4 | A task's calendar date is identical in every timezone | both |
| I-5 | Completing N tasks on one day increments the streak exactly once | server |
| I-6 | A completed task is never shown as Overdue | both |
| I-7 | An empty dataset yields `0`, never `NaN`, `Infinity`, or `null` | both |
| I-8 | Every stored enum value is a member of its declared set | server |
| I-9 | No credential or token is written to logs | server |
| I-10 | Statistics can always be recomputed from source records | server |

I-7 and I-10 are the two most likely to be broken by well-meaning aggregation code in
Phase 3, since pipelines over empty collections return no documents rather than a zero.

---

## 5. Cross-Cutting Defects

Fixed in Phase 1 unless noted. Each was a violation of a rule stated above.

| # | Defect | Rule violated | Fix |
|---|---|---|---|
| B-1 | Deadlines shift one day earlier in negative UTC offsets | R-DATE-1…5 | Anchor at local noon on write |
| B-2 | `formatDateKey` parses `YYYY-MM-DD` as UTC, so streaks reset instead of incrementing behind UTC | R-DATE-5 | Parse as local |
| B-3 | `reminder()` and streak logic use different date normalisation | R-DATE-4 | One shared util |
| B-4 | Empty-string enum values persist via `findOneAndUpdate` without `runValidators` | R-TASK-7, R-TASK-8 | `runValidators: true`, reject `''` |
| B-5 | Tasks with invalid status fall outside every counter, skewing progress | R-STAT-4 | Fixed by B-4 |
| B-6 | Streak is unscoped by user and survives logout | R-STREAK-7 | ⬜ Phase 2 |
| B-7 | Failed refresh leaves the user authenticated on a 401 page | R-CAUTH-4 | Clear state and redirect |
| B-8 | `AuthProvider` checks token presence, never expiry | R-CAUTH-1 | Decode `exp` |
| B-9 | `isRunning` stored in two different encodings | R-FOCUS-6 | One encoder |
| B-10 | `timeLeft = 0` falls through to the full duration | R-FOCUS-7 | Explicit null check |
| B-11 | `handleReset` writes `false`, `handleStartPause` writes `"false"` | R-FOCUS-6 | One encoder |
| B-12 | Delete has no confirmation | R-UI-3 | Confirmation dialog |
| B-13 | Login reports "User not found" separately from "Invalid credentials" | R-AUTH-7 | Fixed |
| B-14 | Server errors return `400` instead of `500` | — | Correct status codes |
| B-15 | `err.message` and raw `Error` objects leak in responses | — | Sanitised envelope |