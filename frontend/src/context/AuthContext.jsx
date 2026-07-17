import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Initial check
    useEffect(() => {
        if (token) {
            // In a real app we might validate token with backend here
            // For now, we trust presence of token + stored user info (or just simple persist)
            // But better: Store only token, user details verify on first request
            // Simulating user restore for simplicity since we don't have a /me endpoint in this strict MVP plan
            // Let's decode or just use what we have. 
            // Better: We'll rely on the Login response data. 
            // Actually, let's keep it simple: If token exists, we are "logged in" but might lack user profile data until we fetch it.
            // For this UI, we just need to know IF we are logged in.
        }
        setLoading(false);
    }, [token]);

    const register = async (email, password) => {
        try {
            await axios.post('/api/auth/register', { email, password });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'Registration failed' };
        }
    };

    const login = async (email, password) => {
        try {
            const res = await axios.post('/api/auth/login', { email, password });
            if (res.data.auth) {
                setToken(res.data.token);
                localStorage.setItem('token', res.data.token);
                // We could decode token to get email, but let's just save it roughly or unset
                setUser({ email });
                return { success: true };
            }
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'Login failed' };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    const api = useMemo(() => {
        const instance = axios.create({
            baseURL: '/api'
        });

        instance.interceptors.request.use((config) => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                config.headers['Authorization'] = `Bearer ${storedToken}`;
            }
            return config;
        }, (error) => {
            return Promise.reject(error);
        });

        instance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return instance;
    }, []);

    const value = {
        user,
        token,
        register,
        login,
        logout,
        api, // Expose per-configured axios instance
        isAuthenticated: !!token
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
