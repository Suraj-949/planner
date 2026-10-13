// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TasksPage from '../src/pages/TasksPage'
import axios from '../src/axiosInstance'

vi.mock('../src/axiosInstance', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))

const row = {
    _id: '507f1f77bcf86cd799439011', title: 'Ship planner', description: 'Release notes',
    status: 'pending', priority: 'medium', category: 'work', context: 'Planner Core',
    deadline: '2026-10-13T12:00:00', estimateMinutes: 30,
}
let stored
beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    stored = { ...row }
    axios.get.mockImplementation(async () => ({ data: { tasks: stored ? [{ ...stored }] : [] } }))
    axios.put.mockImplementation(async (_url, changes) => {
        stored = { ...stored, ...changes }
        return { data: { task: stored } }
    })
    axios.delete.mockImplementation(async () => { stored = null; return { data: {} } })
})
afterEach(cleanup)

async function openPage() {
    render(<MemoryRouter initialEntries={['/tasks']}><Routes>
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/timer" element={<h1>Focus timer page</h1>} />
    </Routes></MemoryRouter>)
    await screen.findByLabelText('Edit Ship planner')
}

test('completion is saved to the API and survives reloading the page', async () => {
    await openPage()
    fireEvent.click(screen.getByLabelText('Mark "Ship planner" as complete'))
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`/tasks/update/${row._id}`, { status: 'completed' }))
    await screen.findByLabelText('Mark "Ship planner" as incomplete')
    cleanup()
    await openPage()
    expect(screen.getByLabelText('Mark "Ship planner" as incomplete').checked).toBe(true)
})

test('failed updates retain the previous status and show an error', async () => {
    axios.put.mockRejectedValueOnce(new Error('offline'))
    await openPage()
    fireEvent.click(screen.getByLabelText('Mark "Ship planner" as complete'))
    await screen.findByText('Task action failed')
    expect(screen.getByLabelText('Mark "Ship planner" as complete').checked).toBe(false)
})

test('in-flight mutations cannot be submitted twice', async () => {
    let resolve
    axios.put.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    await openPage()
    const checkbox = screen.getByLabelText('Mark "Ship planner" as complete')
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    expect(axios.put).toHaveBeenCalledTimes(1)
    resolve({ data: { task: row } })
    await waitFor(() => expect(checkbox.disabled).toBe(false))
})

test('editing retains API fields and saves changes', async () => {
    await openPage()
    fireEvent.click(screen.getByLabelText('Edit Ship planner'))
    expect(within(screen.getByRole('dialog')).getByLabelText('Description').value).toBe('Release notes')
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Ship safely' } })
    fireEvent.submit(screen.getByLabelText('Task title').closest('form'))
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`/tasks/update/${row._id}`, expect.objectContaining({ title: 'Ship safely', category: 'work', deadline: '2026-10-13' })))
    await screen.findByLabelText('Edit Ship safely')
})

test('deletion requires confirmation; cancellation does not delete', async () => {
    await openPage()
    fireEvent.click(screen.getByLabelText('Delete Ship planner'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(axios.delete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Delete Ship planner'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }))
    await screen.findByText('Nothing here yet')
    expect(axios.delete).toHaveBeenCalledWith(`/tasks/delete/${row._id}`)
})

test('focus saves in-progress before navigating to the timer', async () => {
    await openPage()
    fireEvent.click(screen.getByRole('button', { name: 'Focus timer' }))
    await screen.findByText('Focus timer page')
    expect(axios.put).toHaveBeenCalledWith(`/tasks/update/${row._id}`, { status: 'in-progress' })
})

test('dropdown and calendar-date filters accept their actual control values', async () => {
    await openPage()
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'completed' } })
    expect(screen.queryByLabelText('Edit Ship planner')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Filter by due date'), { target: { value: '2026-10-13' } })
    expect(screen.getByLabelText('Edit Ship planner')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filter by due date'), { target: { value: '2026-10-14' } })
    expect(screen.queryByLabelText('Edit Ship planner')).toBeNull()
})

test('failed deletion leaves the confirmation open with a visible error', async () => {
    axios.delete.mockRejectedValueOnce(new Error('offline'))
    await openPage()
    fireEvent.click(screen.getByLabelText('Delete Ship planner'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(stored).not.toBeNull()
})

test('search includes task descriptions', async () => {
    await openPage()
    fireEvent.change(screen.getByPlaceholderText('Filter tasks or tags...'), { target: { value: 'Release notes' } })
    expect(screen.getByLabelText('Edit Ship planner')).toBeTruthy()
})

test('failed focus updates do not navigate away', async () => {
    axios.put.mockRejectedValueOnce(new Error('offline'))
    await openPage()
    fireEvent.click(screen.getByRole('button', { name: 'Focus timer' }))
    await screen.findByText('Task action failed')
    expect(screen.queryByText('Focus timer page')).toBeNull()
})

test('sample rows are read-only when loading the API fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline'))
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await screen.findByText('Showing sample data')
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox.disabled).toBe(true)
    for (const button of screen.getAllByRole('button', { name: /^Edit / })) expect(button.disabled).toBe(true)
    expect(axios.put).not.toHaveBeenCalled()
})
