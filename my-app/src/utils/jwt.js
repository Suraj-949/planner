// Minimal JWT payload decoder.
//
// The access token is stored in localStorage, so its presence alone says nothing about
// whether it is still valid. Reading the `exp` claim lets the client treat an expired
// token as signed-out instead of letting the request fail at the server and stranding the
// user on a page that cannot load its data.
//
// This is a *convenience* check only — the server remains the authority. A forged or
// tampered token is still rejected there, because this never verifies the signature.

const BASE64_URL = /^[A-Za-z0-9_-]+$/

const decodePayload = (token) => {
    if (typeof token !== 'string') return null

    const parts = token.split('.')

    if (parts.length !== 3 || !BASE64_URL.test(parts[1])) return null

    try {
        // base64url → base64 → JSON. `atob` needs the URL-safe alphabet swapped back and
        // the padding restored, otherwise it throws on tokens whose length is not a
        // multiple of four.
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
        const json = decodeURIComponent(
            Array.from(atob(padded))
                .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
                .join('')
        )

        return JSON.parse(json)
    } catch {
        // A malformed payload must not throw during render.
        return null
    }
}

export const getTokenExpiry = (token) => {
    const payload = decodePayload(token)

    if (!payload?.exp) return null

    // `exp` is seconds since the epoch; Date.now() is milliseconds.
    return payload.exp * 1000
}

export const isTokenExpired = (token, clockSkewMs = 30_000) => {
    const expiry = getTokenExpiry(token)

    if (expiry === null) return true

    // A small skew window means a token that expires mid-request is treated as already
    // dead, so the client refreshes rather than sending a token the server will reject.
    return Date.now() + clockSkewMs >= expiry
}

export default decodePayload
