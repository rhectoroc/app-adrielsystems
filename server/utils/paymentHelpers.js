// Payment Business Logic Helper Functions
export const calculatePaymentStatus = (dueDate, prepaidUntil) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If prepaid, check prepaid date
    if (prepaidUntil) {
        const prepaidDate = new Date(prepaidUntil);
        prepaidDate.setHours(0, 0, 0, 0);
        if (prepaidDate >= today) {
            return 'PAGADO';
        }
    }

    // Check due date
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
        return 'VENCIDO';
    } else if (due.getTime() === today.getTime() || due > today) {
        return 'PENDIENTE';
    }

    return 'PENDIENTE';
};

export const calculateDaysOverdue = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
};

export const calculateNextDueDate = (renewalDay, lastPaymentDate) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Start with current month
    let nextDue = new Date(currentYear, currentMonth, renewalDay);

    // If the due date for this month has passed, move to next month
    if (nextDue < today) {
        nextDue = new Date(currentYear, currentMonth + 1, renewalDay);
    }

    return nextDue;
};

export const calculateDaysUntilDue = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 ? diffDays : 0;
};
