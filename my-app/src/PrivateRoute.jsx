import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { isTokenExpired } from './utils/jwt'
import { ACCESS_TOKEN_KEY } from './axiosInstance'

/*
 * Redirects unauthenticated visitors to the login screen. The attempted path is carried
 * in location state so the user lands back where they were headed after signing in,
 * instead of always landing on the default page.
 *
 * Expiry is checked here as well as in AuthProvider: a token can expire while the tab is
 * open, and without this the user would sit on a page whose every request 401s.
 */
const PrivateRoute = ({ children }) => {
    const { isAuthenticated } = useAuth()
    const location = useLocation()

    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (!isAuthenticated || !token || isTokenExpired(token)) {
        if (token && isTokenExpired(token)) {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
        }

        return <Navigate to="/" replace state={{ from: location.pathname }} />
    }

    return children
}

export default PrivateRoute
