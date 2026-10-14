// Single source of truth for task enums and their visual mapping.
//
// Must stay aligned with backend/src/models/task.model.js. Every dropdown, badge and
// filter reads from here — no component should hardcode these lists.

export const TASK_STATUSES = ['pending', 'in-progress', 'completed']

export const TASK_PRIORITIES = ['high', 'medium', 'low']

/*
 * The preset categories the form and filter bar offer. `category` itself is free text on
 * the server (bounded, not enum-locked) so the form's Custom option can store a label of
 * the user's own — this list only drives the dropdown.
 */
export const TASK_CATEGORIES = ['personal', 'learning', 'office-work', 'side hustle']

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
    personal: 'Personal',
    learning: 'Learning',
    'office-work': 'Office Work',
    'side hustle': 'Side Hustle',
}

// Sentinel shown as the last option in the category select. Never sent to the API —
// choosing it reveals a text input whose trimmed value becomes the category instead.
export const CUSTOM_CATEGORY = '__custom__'

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

// Task filter tabs. Counts are supplied live by the page — the design reference shipped
// placeholders (14/7/5/24) that had no relation to the rows actually rendered.
export const TASK_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Completed' },
]

// Layout options for the task list. Board and calendar are placeholders for now.
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

/*
 * Recurrence presets that map 1:1 onto the backend's `{ freq, interval, daysOfWeek }`
 * rule. "Weekdays" used to sit in this list with no equivalent in the schema, so choosing
 * it stored nothing at all — the field was decorative.
 */
export const RECURRING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'monthly', label: 'Monthly' },
]

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Serialise the chosen preset into the rule the API stores, or undefined for none.
export const toRecurrence = (preset, daysOfWeek) => {
    if (!preset || preset === 'none') return undefined
    if (preset === 'daily') return { freq: 'daily', interval: 1 }
    if (preset === 'monthly') return { freq: 'monthly', interval: 1 }
    if (preset === 'weekdays') return { freq: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] }

    if (preset === 'weekly') {
        // A weekly rule naming no days is rejected server-side. Falling back to Monday
        // rather than failing the save keeps the form usable without a second validation
        // pass, and the user sees the chip they did not pick light up.
        const days = Array.isArray(daysOfWeek) && daysOfWeek.length
            ? [...daysOfWeek].sort((a, b) => a - b)
            : [1]

        return { freq: 'weekly', interval: 1, daysOfWeek: days }
    }

    return undefined
}

// Inverse, for repopulating the form when editing an existing task.
export const fromRecurrence = (recurrence) => {
    if (!recurrence) return { preset: 'none', daysOfWeek: [] }

    const days = Array.isArray(recurrence.daysOfWeek) ? recurrence.daysOfWeek : []

    if (recurrence.freq === 'monthly') return { preset: 'monthly', daysOfWeek: [] }
    if (recurrence.freq === 'daily') return { preset: 'daily', daysOfWeek: [] }

    if (recurrence.freq === 'weekly') {
        const isWeekdays =
            days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))

        return { preset: isWeekdays ? 'weekdays' : 'weekly', daysOfWeek: days }
    }

    return { preset: 'none', daysOfWeek: [] }
}
