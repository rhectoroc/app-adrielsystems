// Simple in-memory rate limiter
// For production, consider using Redis or a dedicated rate limiting service

const requestCounts = new Map();
const loginAttempts = new Map();

// Clean up old entries every 15 minutes
setInterval(() => {
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    for (const [key, data] of requestCounts.entries()) {
        if (now - data.resetTime > fifteenMinutes) {
            requestCounts.delete(key);
        }
    }

    for (const [key, data] of loginAttempts.entries()) {
        if (now - data.resetTime > fifteenMinutes) {
            loginAttempts.delete(key);
        }
    }
}, 15 * 60 * 1000);

// General rate limiter
export const rateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // Max requests per window
        message = 'Too many requests, please try again later'
    } = options;

    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        if (!requestCounts.has(key)) {
            requestCounts.set(key, {
                count: 1,
                resetTime: now
            });
            return next();
        }

        const data = requestCounts.get(key);

        if (now - data.resetTime > windowMs) {
            // Reset window
            data.count = 1;
            data.resetTime = now;
            return next();
        }

        if (data.count >= max) {
            return res.status(429).json({ message });
        }

        data.count++;
        next();
    };
};

// Login-specific rate limiter with account lockout
export const loginRateLimiter = (req, res, next) => {
    const email = req.body.email;
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${email}:${ip}`;
    const now = Date.now();

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

    if (!loginAttempts.has(key)) {
        loginAttempts.set(key, {
            count: 1,
            resetTime: now,
            lockedUntil: null
        });
        return next();
    }

    const data = loginAttempts.get(key);

    // Check if account is locked
    if (data.lockedUntil && now < data.lockedUntil) {
        const remainingTime = Math.ceil((data.lockedUntil - now) / 60000);
        return res.status(429).json({
            message: `Cuenta bloqueada temporalmente. Intenta nuevamente en ${remainingTime} minutos.`
        });
    }

    // Reset if window expired
    if (now - data.resetTime > LOCKOUT_DURATION) {
        data.count = 1;
        data.resetTime = now;
        data.lockedUntil = null;
        return next();
    }

    // Increment attempt count
    data.count++;

    // Lock account if max attempts reached
    if (data.count >= MAX_ATTEMPTS) {
        data.lockedUntil = now + LOCKOUT_DURATION;
        return res.status(429).json({
            message: `Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.`
        });
    }

    // Warn user about remaining attempts
    const remainingAttempts = MAX_ATTEMPTS - data.count;
    if (remainingAttempts <= 2) {
        res.locals.warningMessage = `${remainingAttempts} intentos restantes antes del bloqueo`;
    }

    next();
};

// Clear failed login attempts on successful login
export const clearLoginAttempts = (email, ip) => {
    const key = `${email}:${ip}`;
    loginAttempts.delete(key);
};
