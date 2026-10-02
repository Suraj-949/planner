// Nav model for the sidebar. Icons are resolved in Sidebar.jsx so this file stays
// free of any dependency and can be reused for a mobile drawer or command palette.

export const PRIMARY_NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tasks', label: 'Tasks', count: 14 },
    { id: 'projects', label: 'Projects' },
    { id: 'goals', label: 'Goals', meta: '68%' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'focus', label: 'Focus', dot: true },
    { id: 'habits', label: 'Habits', meta: '12d' },
    { id: 'analytics', label: 'Analytics' },
]

export const SECONDARY_NAV = [
    { id: 'settings', label: 'Settings' },
    { id: 'help', label: 'Help & Docs' },
]

export const WORKSPACE = {
    name: "Suraj's Workspace",
    plan: 'Personal Pro',
}
