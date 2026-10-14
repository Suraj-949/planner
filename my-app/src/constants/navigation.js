// Nav model for the sidebar. Icons are resolved in Sidebar.jsx so this file stays
// free of any dependency and can be reused for a mobile drawer or command palette.
//
// `to` is the route. The sidebar highlights from the URL rather than from a piece of
// component state, which is what stops the nav disagreeing with the page after a browser
// back or a deep link.

export const PRIMARY_NAV = [
    { id: 'dashboard', label: 'Dashboard', to: '/dashboard' },
    { id: 'tasks', label: 'Tasks', to: '/tasks' },
    { id: 'projects', label: 'Projects', to: '/projects' },
    { id: 'goals', label: 'Goals', to: '/goals' },
    { id: 'planner', label: 'Planner', to: '/planner' },
    { id: 'calendar', label: 'Calendar', to: '/calendar' },
    { id: 'focus', label: 'Focus', to: '/focus' },
    { id: 'habits', label: 'Habits', to: '/habits' },
    { id: 'analytics', label: 'Analytics', to: '/analytics' },
]

export const SECONDARY_NAV = [
    { id: 'settings', label: 'Settings', to: '/settings' },
    { id: 'help', label: 'Help & Docs', to: '/help' },
]

/*
 * Heading for each route.
 *
 * One map rather than a `title` prop threaded through every page, so a new page cannot
 * forget it and render with the previous route's heading.
 */
export const PAGE_TITLES = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Today at a glance' },
    '/tasks': { title: 'My Tasks', subtitle: 'Everything you need to get done with precision latency.' },
    '/projects': { title: 'Projects', subtitle: 'Group the work that serves one outcome.' },
    '/goals': { title: 'Goals', subtitle: 'Milestones on the way to something bigger.' },
    '/planner': { title: 'Planner', subtitle: 'The week ahead, day by day.' },
    '/calendar': { title: 'Calendar', subtitle: 'Deadlines across the month.' },
    '/focus': { title: 'Focus', subtitle: 'One task, twenty-five minutes.' },
    '/habits': { title: 'Habits', subtitle: 'Repetition, tracked honestly.' },
    '/analytics': { title: 'Analytics', subtitle: 'Where the time actually went.' },
}

export const PAGE_TITLES_DYNAMIC = [
    { match: /^\/projects\//, title: 'Project', subtitle: '' },
    { match: /^\/goals\//, title: 'Goal', subtitle: '' },
    { match: /^\/tasks\//, title: 'Task', subtitle: '' },
]

export const titleForPath = (pathname) => {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

    const dynamic = PAGE_TITLES_DYNAMIC.find((entry) => entry.match.test(pathname))

    return dynamic ?? { title: 'Planner', subtitle: '' }
}

export const WORKSPACE = {
    name: "Suraj's Workspace",
    plan: 'Personal Pro',
}
