// Task endpoints.
//
// Query builders live here rather than in the page, so the parameter names the client
// sends cannot drift from the ones the controller reads — a typo in a filter name fails
// silently as "no results" rather than as a wrong request.

import { get, post, put, del } from './http'

/*
 * `q` searches title, description, notes, subtask titles and tags. `sort` accepts
 * `created`, `deadline` or `title`; `page`/`limit` are capped server-side at 100.
 *
 * The 'all' sentinel used by the filter bar is translated here, not in the page: the
 * transport drops empty strings, but 'all' is a real string and would be sent as a filter.
 */
export const list = ({ status, priority, category, projectId, goalId, from, to, q, sort, order, page, limit } = {}) =>
    get('/tasks/fetch', {
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        category: category === 'all' ? undefined : category,
        projectId,
        goalId,
        from,
        to,
        q,
        sort,
        order,
        page,
        limit,
    })

export const detail = (id) => get(`/tasks/fetch/${id}`)

export const create = (body) => post('/tasks/create', body)

export const update = (id, body) => put(`/tasks/update/${id}`, body)

export const remove = (id) => del(`/tasks/delete/${id}`)

export const stats = ({ projectId, goalId, from, to } = {}) => get('/tasks/stats', { projectId, goalId, from, to })

export const streak = () => get('/tasks/streak')
