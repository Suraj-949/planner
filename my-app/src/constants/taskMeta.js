// Single source of truth for task enums and their visual mapping.
//
// Must stay aligned with backend/src/models/task.model.js. Every dropdown, badge and
// filter reads from here — no component should hardcode these lists.

export const TASK_STATUSES = ['pending', 'in-progress', 'completed']

export const TASK_PRIORITIES = ['high', 'medium', 'low']

export const TASK_CATEGORIES = [
    'DSA',
    'development',
    'college',
    'personal',
    'work',
    'other',
]

export const STATUS_LABELS = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    completed: 'Completed',
}

export const PRIORITY_LABELS = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
}

export const CATEGORY_LABELS = {
    DSA: 'DSA',
    development: 'Development',
    college: 'College',
    personal: 'Personal',
    work: 'Work',
    other: 'Other',
}

// Status → dot colour. Completed is green, in-progress is the accent, pending is neutral.
export const STATUS_DOT = {
    pending: 'bg-content-subtle',
    'in-progress': 'bg-primary',
    completed: 'bg-secondary',
}

export const PRIORITY_BADGE = {
    high: 'bg-high-soft text-high-text',
    medium: 'bg-medium-soft text-medium-text',
    low: 'bg-low-soft text-low-text',
}

// Task filter tabs. `key` is matched against a task by TaskRow.
export const TASK_FILTERS = [
    { id: 'all', label: 'All', count: 14 },
    { id: 'today', label: 'Today', count: 7 },
    { id: 'upcoming', label: 'Upcoming', count: 5 },
    { id: 'completed', label: 'Completed', count: 24 },
]

export const VIEW_MODES = [
    { id: 'list', label: 'List' },
    { id: 'board', label: 'Board' },
    { id: 'calendar', label: 'Calendar' },
]

// Badge variant per reminder state. Red for overdue, accent for due today,
// neutral for tomorrow. See BUSINESS-LOGIC.md §3.3.
export const REMINDER_VARIANTS = {
    overdue: 'danger',
    today: 'primary',
    tomorrow: 'neutral',
}

export const PRIORITY_VARIANTS = {
    high: 'high',
    medium: 'medium',
    low: 'low',
}

export const STATUS_VARIANTS = {
    pending: 'neutral',
    'in-progress': 'primary',
    completed: 'secondary',
}

export const PROJECTS = ['Planner Core', 'Obsidian UI', 'Strategy 2025', 'Infrastructure']

export const RECURRING_OPTIONS = ['None', 'Daily', 'Weekly', 'Monthly', 'Weekdays']
