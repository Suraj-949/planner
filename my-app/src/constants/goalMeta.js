// Goal enums and labels.
//
// Mirrors backend/src/constants/index.js. The frontend cannot import that module across the
// package boundary, so this is a hand-maintained copy — the same position `taskMeta.js` is
// in. `GOAL_STATUSES` must stay identical to the backend's or a status the API accepts
// would render with no label, and one it rejects would render with one.

export const GOAL_STATUSES = ['active', 'completed', 'abandoned']

export const GOAL_STATUS_LABELS = {
    active: 'Active',
    completed: 'Completed',
    abandoned: 'Abandoned',
}

export const GOAL_STATUS_VARIANTS = {
    active: 'primary',
    completed: 'secondary',
    abandoned: 'neutral',
}

/*
 * A goal's progress is derived from its milestones (R-GOAL-1) and is never stored, so this
 * only describes how to *render* it. The number itself always comes from the API.
 */
export const PROGRESS_TONE = (percent) => {
    if (percent >= 100) return 'bg-secondary'
    if (percent >= 50) return 'bg-primary'
    return 'bg-medium'
}
