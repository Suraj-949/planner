import { useCallback, useState } from 'react';
import AuthContext from './context/AuthContext';
import axiosInstance, { ACCESS_TOKEN_KEY } from './axiosInstance';
import { isTokenExpired } from './utils/jwt';

/*
 * A stored token only counts as a session if it is still inside its validity window.
 * Checking presence alone left an expired token routing the user into authenticated
 * pages, where every request 401'd and the UI rendered empty.
 */
const hasStoredSession = () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!token) return false;

    if (isTokenExpired(token)) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        return false;
    }

    return true;
};

/*
 * The session flag is the single source of truth for routing. It was previously set to
 * true/false by hand at each call site, so a page could disagree with the token that was
 * actually stored.
 */
const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const login = useCallback((accessToken) => {
        if (!accessToken) return;

        if (isTokenExpired(accessToken)) {
            // A token that is already dead on arrival is not a session.
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            setIsAuthenticated(false);
            return;
        }

        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        setIsAuthenticated(true);
    }, []);

    /*
     * Clearing the refresh cookie is a server call; the local token is dropped either
     * way, so a failed request can never leave the user stuck in a half-signed-in state.
     */
    const logout = useCallback(async () => {
        setIsLoggingOut(true);

        try {
            await axiosInstance.post('/auth/logout');
        } catch {
            // Ignore — the local session is cleared regardless.
        } finally {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            setIsAuthenticated(false);
            setIsLoggingOut(false);
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, setIsAuthenticated, login, logout, isLoggingOut }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
