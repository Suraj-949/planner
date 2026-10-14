// Habit endpoints.
//
// Every habit returned by `list` and `detail` carries `currentStreak`, `longestStreak` and
// `completionRate`, derived server-side from the completion rows. Nothing here recomputes
// them, and nothing stores them — the numbers cannot drift because they are never written.

import { get, post, put, patch, del } from './http'

export const list = ({ archived } = {}) => get('/habits/fetch', { archived: archived ? 'true' : undefined })

export const detail = (id) => get(`/habits/fetch/${id}`)

// Local `YYYY-MM-DD` keys on which the habit was completed, newest first.
export const history = (id) => get(`/habits/history/${id}`)

export const create = (body) => post('/habits/create', body)

export const update = (id, body) => put(`/habits/update/${id}`, body)

/*
 * Tick or untick a day. Idempotent server-side: ticking twice creates one row, enforced by
 * a unique index on (habitId, date), so a double-click cannot inflate the streak.
 */
export const tick = (id, { date, completed } = {}) => post(`/habits/tick/${id}`, { date, completed })

export const archive = (id) => patch(`/habits/archive/${id}`)

export const restore = (id) => patch(`/habits/restore/${id}`)

// Removes the habit and its completion history together.
export const remove = (id) => del(`/habits/delete/${id}`)
