// Task filtering rules, extracted from the page component so each rule is
// independently testable and the component stays presentational.

const matchesTab = (task, tab) => {
    if (tab === 'all') return true
    if (tab === 'completed') return task.status === 'completed'
    if (tab === 'today') return task.dayOffset === 0 && task.status !== 'completed'
    if (tab === 'upcoming') return task.dayOffset > 0

    return true
}

const matchesQuery = (task, query) => {
    const needle = query.trim().toLowerCase()

    if (!needle) return true

    return [task.title, task.context, task.status, task.priority, ...(task.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(needle)
}

export const filterTasks = (tasks, { tab, query, status, priority, category, dueDate }) =>
    tasks.filter((task) => {
        if (!matchesTab(task, tab)) return false
        if (!matchesQuery(task, query)) return false
        if (status !== 'all' && task.status !== status) return false
        if (priority !== 'all' && task.priority !== priority) return false
        if (category !== 'all' && task.context !== category) return false
        if (dueDate && task.dayOffset !== Number(dueDate)) return false

        return true
    })

export { matchesTab, matchesQuery }
