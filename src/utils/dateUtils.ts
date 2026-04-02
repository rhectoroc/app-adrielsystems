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
