// Transport layer for the API-per-domain services.
//
// One place builds query strings and unwraps the call, so a service file is a list of
// endpoints rather than a list of axios calls that each have to remember the same three
// details: the base URL lives on the axios instance, the `{ ok, data }` envelope is already
// unwrapped by its response interceptor, and credentials ride along for the refresh cookie.

import axiosInstance from '../axiosInstance'

/*
 * Drops the keys a filter leaves behind when nothing is selected.
 *
 * `undefined`, `null` and `''` all mean "no constraint" here. They are dropped rather than
 * serialised, so a query with no filters is `/tasks/fetch` and not `/tasks/fetch?status=`,
 * which the server would read as a status literally named "".
 */
export const toQuery = (params) => {
    if (!params) return ''

    const search = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue

        search.set(key, String(value))
    }

    const text = search.toString()

    return text ? `?${text}` : ''
}

// Each returns the unwrapped payload — `response.data` after the interceptor has already
// removed the envelope — so a caller writes `data.tasks`, not `response.data.data.tasks`.
export const get = (path, params) => axiosInstance.get(`${path}${toQuery(params)}`).then((r) => r.data)

export const post = (path, body) => axiosInstance.post(path, body).then((r) => r.data)

export const put = (path, body) => axiosInstance.put(path, body).then((r) => r.data)

export const patch = (path, body) => axiosInstance.patch(path, body).then((r) => r.data)

export const del = (path) => axiosInstance.delete(path).then((r) => r.data)
