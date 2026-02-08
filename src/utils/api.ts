// API Helper to include JWT token in requests

export const apiRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Merge existing headers
    if (options.headers) {
        const existingHeaders = options.headers as Record<string, string>;
        Object.assign(headers, existingHeaders);
    }

    // Add authorization token if available
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Handle token expiration
    // Handle token expiration and invalid token
    if (response.status === 401 || response.status === 403) {
        try {
            // Clone response to not consume the body for the caller
            const clone = response.clone();
            const data = await clone.json();

            // Only redirect if explicitly token related
            if (data.message === 'Token expired' ||
                data.message === 'Invalid token' ||
                data.message === 'Access token required') {

                // Clear auth data and redirect to login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_role');
                localStorage.removeItem('auth_user');
                console.warn('Session expired or invalid, redirecting to login...');

                // Use window.location only if not already there to prevent loops
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }

                throw new Error(data.message);
            }
        } catch (e) {
            // Ignore JSON parse errors or other issues here, let the caller handle the 401/403 response
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
