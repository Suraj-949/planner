// Goal endpoints. Every response goal carries a derived `progress` block computed
// server-side from its milestones, so nothing here has to re-derive it.

import { get, post, put, del } from './http'

export const list = ({ status } = {}) => get('/goals/fetch', { status: status === 'all' ? undefined : status })

export const detail = (id) => get(`/goals/fetch/${id}`)

export const create = (body) => post('/goals/create', body)

export const update = (id, body) => put(`/goals/update/${id}`, body)

// Deleting a goal also removes its milestones. Linked tasks are unlinked rather than
// deleted, so open work survives the goal that used to group it.
export const remove = (id) => del(`/goals/delete/${id}`)
