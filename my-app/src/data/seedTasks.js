// Seed data for the task dashboard. Mirrors the design reference so the layout is verifiable without a backend, and doubles as the shape the API should return.

// Field notes:
//  - `id`        stable client key
//  - `context`   project the task belongs to
//  - `estimate`  formatted duration string, matching the reference
//  - `due`       pre-formatted label; a real integration should format from `deadline`
//  - `tags`      matched by the free-text filter
//  - `dayOffset` whole days from "today", used by the Today/Upcoming tabs

export const SEED_TASKS = [
    {
        id: 'seed-1',
        title: 'Complete React Authentication',
        context: 'Planner Core',
        estimate: '1h 30m',
        priority: 'high',
        status: 'in-progress',
        due: 'Today, 5:00 PM',
        dayOffset: 0,
        tags: ['auth', 'react', 'planner-core'],
    },
    {
        id: 'seed-2',
        title: 'Draft Product Roadmap Q3',
        context: 'Strategy 2025',
        estimate: '45m',
        priority: 'medium',
        status: 'pending',
        due: 'Today',
        dayOffset: 0,
        tags: ['roadmap', 'strategy'],
    },
    {
        id: 'seed-3',
        title: 'Design System Icon Audit',
        context: 'Obsidian UI',
        estimate: '30m',
        priority: 'low',
        status: 'pending',
        due: 'Tomorrow',
        dayOffset: 1,
        tags: ['design', 'icons', 'obsidian'],
    },
    {
        id: 'seed-4',
        title: 'Database schema migration for habits streak tracking',
        context: 'Planner Core',
        estimate: '2h 15m',
        priority: 'high',
        status: 'in-progress',
        due: 'Oct 28',
        dayOffset: 4,
        tags: ['database', 'migration', 'habits'],
    },
    {
        id: 'seed-5',
        title: 'Write unit tests for pomodoro focus timer',
        context: 'Planner Core',
        estimate: '1h 00m',
        priority: 'medium',
        status: 'pending',
        due: 'Oct 29',
        dayOffset: 5,
        tags: ['tests', 'pomodoro'],
    },
    {
        id: 'seed-6',
        title: 'Optimize PostgreSQL queries for analytics dashboard',
        context: 'Infrastructure',
        estimate: '3h 00m',
        priority: 'high',
        status: 'pending',
        due: 'Oct 30',
        dayOffset: 6,
        tags: ['postgres', 'performance', 'analytics'],
    },
]

export const SEED_COMPLETED = [
    {
        id: 'seed-done-1',
        title: 'Review Pull Request #42',
        context: 'Planner Core',
        estimate: '25m',
        priority: 'medium',
        status: 'completed',
        due: 'Today',
        dayOffset: 0,
        tags: ['review', 'pr'],
    },
    {
        id: 'seed-done-2',
        title: 'Sync with Engineering Leads',
        context: 'Strategy 2025',
        estimate: '30m',
        priority: 'low',
        status: 'completed',
        due: 'Today',
        dayOffset: 0,
        tags: ['sync', 'meeting'],
    },
]

export const SEED = [...SEED_TASKS, ...SEED_COMPLETED]
