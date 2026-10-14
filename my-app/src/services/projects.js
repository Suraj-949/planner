// Project endpoints.
//
// A project is archived rather than deleted, so the tasks that belonged to it keep a
// parent to point at. `remove` therefore archives, which is what the UI calls "put away".

import { get, post, put, patch, del } from './http'

export const list = ({ goalId, archived } = {}) =>
    get('/projects/fetch', { goalId, archived: archived ? 'true' : undefined })

export const create = (body) => post('/projects/create', body)

export const update = (id, body) => put(`/projects/update/${id}`, body)

export const archive = (id) => patch(`/projects/archive/${id}`)

export const restore = (id) => patch(`/projects/restore/${id}`)

export const remove = (id) => del(`/projects/delete/${id}`)
