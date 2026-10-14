// Milestone endpoints.
//
// Milestones carry no `userId` of their own — they are authorised through the goal that
// owns them — so every call names either the goal it is being listed under or the
// milestone it is acting on.

import { get, post, put, patch, del } from './http'

export const listForGoal = (goalId) => get('/milestones/fetch', { goalId })

export const create = (body) => post('/milestones/create', body)

export const update = (id, body) => put(`/milestones/update/${id}`, body)

/*
 * Ticking sets `completedAt` to now; unticking clears it.
 *
 * The timestamp rather than a boolean is what makes a late milestone legible later — which
 * one slipped, and by how much — and it is also what R-GOAL-1 counts when it derives a
 * goal's progress.
 */
export const setCompleted = (id, completed) => patch(`/milestones/complete/${id}`, { completed })

export const remove = (id) => del(`/milestones/delete/${id}`)
