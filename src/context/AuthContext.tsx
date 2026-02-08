import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// Security Configuration
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_LOGOUT = 5 * 60 * 1000; // 5 minutes warning
const TOKEN_REFRESH_THRESHOLD = 60 * 60 * 1000; // Refresh if less than 1 hour remaining

// Define types
type UserRole = 'ADMIN' | 'CLIENT';

interface User {
    id: string;
    email: string;
    name: string;
    client_id?: string;
}

interface AuthContextType {
    user: User | null;
    role: UserRole | null;
    token: string | null;
    login: (token: string, role: UserRole, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to decode JWT and check expiration
const isTokenExpired = (token: string): boolean => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        return Date.now() >= expirationTime;
    } catch {
        return true; // If we can't decode, consider it expired
    }
};

const getTokenExpirationTime = (token: string): number | null => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000;
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [showWarning, setShowWarning] = useState(false);

    const inactivityTimerRef = useRef<number | null>(null);
    const warningTimerRef = useRef<number | null>(null);
    const tokenCheckIntervalRef = useRef<number | null>(null);

    const clearAllTimers = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (tokenCheckIntervalRef.current) clearInterval(tokenCheckIntervalRef.current);
    };

    const logout = useCallback(() => {
        clearAllTimers();
        setToken(null);
        setRole(null);
        setUser(null);
        setShowWarning(false);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('last_activity');
    }, []);

    const handleInactivityLogout = useCallback(() => {
        toast.error('Sesión cerrada por inactividad');
        logout();
        window.location.href = '/login';
    }, [logout]);

    const resetInactivityTimer = useCallback(() => {
        clearAllTimers();
        setShowWarning(false);

        // Store last activity time
        localStorage.setItem('last_activity', Date.now().toString());

        // Set warning timer (25 minutes)
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
            toast.warning('Tu sesión expirará en 5 minutos por inactividad', {
                duration: 10000,
            });
        }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

        // Set logout timer (30 minutes)
        inactivityTimerRef.current = setTimeout(handleInactivityLogout, INACTIVITY_TIMEOUT);
    }, [handleInactivityLogout]);

    const login = (newToken: string, newRole: UserRole, newUser: User) => {
        // Validate token before accepting
        if (isTokenExpired(newToken)) {
            toast.error('El token de autenticación ha expirado');
            return;
        }

        setToken(newToken);
        setRole(newRole);
        setUser(newUser);

        // Persist to localStorage
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_role', newRole);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        localStorage.setItem('last_activity', Date.now().toString());

        // Start inactivity tracking
        resetInactivityTimer();
    };

    // Track user activity
    useEffect(() => {
        if (!token) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        const handleActivity = () => {
            resetInactivityTimer();
        };

        events.forEach(event => {
            document.addEventListener(event, handleActivity);
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
        };
    }, [token, resetInactivityTimer]);

    // Check token expiration periodically
    useEffect(() => {
        if (!token) return;

        tokenCheckIntervalRef.current = setInterval(() => {
            if (isTokenExpired(token)) {
                toast.error('Tu sesión ha expirado');
                logout();
                window.location.href = '/login';
            } else {
                // Check if token is about to expire (less than 1 hour)
                const expirationTime = getTokenExpirationTime(token);
                if (expirationTime && expirationTime - Date.now() < TOKEN_REFRESH_THRESHOLD) {
                    toast.info('Tu sesión está por expirar. Por favor, vuelve a iniciar sesión pronto.');
                }
            }
        }, 60000); // Check every minute

        return () => {
            if (tokenCheckIntervalRef.current) {
                clearInterval(tokenCheckIntervalRef.current);
            }
        };
    }, [token, logout]);

    // Restore session from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
        const storedRole = localStorage.getItem('auth_role') as UserRole | null;
        const storedUser = localStorage.getItem('auth_user');
        const lastActivity = localStorage.getItem('last_activity');

        if (storedToken && storedRole && storedUser) {
            // Check if token is expired
            if (isTokenExpired(storedToken)) {
                toast.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
                logout();
                return;
            }

            // Check if session expired due to inactivity
            if (lastActivity) {
                const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
                if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
                    toast.error('Tu sesión expiró por inactividad');
                    logout();
                    return;
                }
            }

            // Restore session
            setToken(storedToken);
            setRole(storedRole);
            setUser(JSON.parse(storedUser));

            // Restart inactivity timer
            resetInactivityTimer();
        }
    }, [logout, resetInactivityTimer]);

    const value = {
        user,
        role,
        token,
        login,
        logout,
        isAuthenticated: !!token,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {/* Inactivity Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-yellow-500/50 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white">Sesión por expirar</h3>
                        </div>
                        <p className="text-gray-300 mb-6">
                            Tu sesión se cerrará en 5 minutos por inactividad. Mueve el mouse o presiona cualquier tecla para mantener tu sesión activa.
                        </p>
                        <button
                            onClick={() => {
                                setShowWarning(false);
                                resetInactivityTimer();
                            }}
                            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                        >
                            Mantener sesión activa
                        </button>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
