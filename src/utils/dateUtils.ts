/**
 * Formats a date string (YYYY-MM-DD) into a safe display format (DD/MM/YYYY)
 * without timezone shifting issues.
 * 
 * @param dateStr - The date string from the API (YYYY-MM-DD or ISO)
 * @returns Formatted date string or 'Pendiente'
 */
export const formatSafeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Pendiente';
    
    try {
        // Split by 'T' to handle ISO strings, then by '-' for the date parts
        const datePart = dateStr.split('T')[0];
        const [year, month, day] = datePart.split('-');
        
        if (!year || !month || !day) return 'Pendiente';
        
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error('Error formatting date:', dateStr, error);
        return 'Pendiente';
    }
};

/**
 * Creates a local Date object from a YYYY-MM-DD string without UTC shifting.
 */
export const parseSafeDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Returns a relative time string (e.g., 'Hace 5 minutos')
 */
export const getTimeAgo = (date: string | Date | null | undefined): string => {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const past = typeof date === 'string' ? new Date(date) : date;
    
    // Check if the date is valid
    if (isNaN(past.getTime())) return 'Fecha inválida';

    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Hace un momento';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `Hace ${diffInDays}d`;
    
    return formatSafeDate(past.toISOString());
};
