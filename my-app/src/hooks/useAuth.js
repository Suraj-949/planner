import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

// Single entry point for reading auth state, so no component touches createContext
// directly and the context shape is defined in exactly one place.
export const useAuth = () => useContext(AuthContext);
