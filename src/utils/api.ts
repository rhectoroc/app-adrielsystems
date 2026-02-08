// API Helper to include JWT token in requests

export const apiRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Handle token expiration
    if (response.status === 401) {
        const data = await response.json();
        if (data.message === 'Token expired' || data.message === 'Invalid token') {
            // Clear auth data and redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_role');
            localStorage.removeItem('auth_user');
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
        }
    }

    return response;
};

// Convenience methods
export const api = {
    get: (url: string, options?: RequestInit) =>
        apiRequest(url, { ...options, method: 'GET' }),

    post: (url: string, body?: any, options?: RequestInit) =>
        apiRequest(url, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        }),

    put: (url: string, body?: any, options?: RequestInit) =>
        apiRequest(url, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        }),

    delete: (url: string, options?: RequestInit) =>
        apiRequest(url, { ...options, method: 'DELETE' }),
};
