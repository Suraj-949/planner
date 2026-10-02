import axios from 'axios';

const baseURL = import.meta.env.VITE_BASE_BACKEND_URL || 'http://localhost:3000/api';

const ACCESS_TOKEN_KEY = 'accessToken';

const axiosInstance = axios.create({
    baseURL,
    // The refresh token lives in an HTTP-only cookie, so it only reaches the server.
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

/*
 * On a 401, try to exchange the refresh cookie for a new access token and replay the
 * original request exactly once.
 *
 * Three fixes over the previous version:
 *  1. `error.config` is undefined for network/CORS failures — touching it unguarded
 *     turned a failed request into an unhandled TypeError.
 *  2. Concurrent 401s all fired a refresh. They are now collapsed into one in-flight
 *     promise, and every waiter resumes on the same result.
 *  3. The original request headers could be undefined, so the retry went out without
 *     an Authorization header and failed again.
 * The request/response payloads are no longer console.logged — they carried the token.
 */

let refreshInFlight = null;

const refreshAccessToken = () => {
    if (!refreshInFlight) {
        refreshInFlight = axiosInstance
            .post('/auth/refresh-token')
            .then((response) => {
                const { accessToken } = response.data ?? {};

                if (!accessToken) {
                    throw new Error('Refresh response did not include an access token');
                }

                localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

                return accessToken;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }

    return refreshInFlight;
};

axiosInstance.interceptors.response.use(
    /*
     * Unwraps the `{ ok, data }` envelope so components receive the payload directly
     * (`response.data.tasks`) instead of every call site reaching through
     * `response.data.data`. The envelope stays a transport concern, owned by one place.
     */
    (response) => {
        if (response?.data && typeof response.data === 'object' && 'data' in response.data) {
            response.data = response.data.data;
        }

        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        const isAuthError = error.response?.status === 401;

        if (!isAuthError || !originalRequest || originalRequest.retry) {
            return Promise.reject(error);
        }

        // Never try to refresh in response to a failed refresh — that would loop.
        if (originalRequest.url?.includes('/auth/refresh-token')) {
            return Promise.reject(error);
        }

        originalRequest.retry = true;

        try {
            const accessToken = await refreshAccessToken();

            originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${accessToken}`,
            };

            return axiosInstance(originalRequest);
        } catch (refreshError) {
            // The refresh cookie is gone or expired: the session is genuinely over.
            localStorage.removeItem(ACCESS_TOKEN_KEY);

            return Promise.reject(refreshError);
        }
    }
);

export default axiosInstance;
export { ACCESS_TOKEN_KEY };
