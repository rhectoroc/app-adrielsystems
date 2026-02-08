import { createContext, useContext, useState, ReactNode } from 'react';

// Define types
type UserRole = 'ADMIN' | 'CLIENT';

interface User {
    email: string;
    name: string;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const login = (newToken: string, newRole: UserRole, newUser: User) => {
        setToken(newToken);
        setRole(newRole);
        setUser(newUser);
        // Persist to localStorage if needed
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_role', newRole);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setRole(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_user');
    };

    // Logic to restore session from localStorage could go here in a useEffect

    const value = {
        user,
        role,
        token,
        login,
        logout,
        isAuthenticated: !!token,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
