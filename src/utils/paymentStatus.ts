// Utility to calculate payment status
// Requirements: Compare current date with client's payment date.

export type PaymentStatus = 'Al día' | 'Pendiente' | 'Vencido';

/**
 * Calculates the payment status for a client based on their payment day and last payment date.
 * 
 * @param paymentDay - The day of the month the client is expected to pay (1-31).
 * @param lastPaymentDate - The date of the last recorded successful payment. Can be null if never paid.
 * @param currentDate - The current date (defaults to now).
 * @param prepaidUntil - Optional date until which the service is prepaid.
 * @returns PaymentStatus ('Al día', 'Pendiente', 'Vencido')
 */
export const getPaymentStatus = (
  paymentDay: number,
  lastPaymentDate: Date | null,
  currentDate: Date = new Date(),
  prepaidUntil: Date | null = null
): PaymentStatus => {
  const today = currentDate;
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Create the deadline date for this month
  // Handle edge cases where month doesn't have the payment day (e.g. Feb 30) by setting to last day of month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const validPaymentDay = Math.min(paymentDay, lastDayOfMonth);

  const paymentDeadline = new Date(currentYear, currentMonth, validPaymentDay);
  paymentDeadline.setHours(23, 59, 59, 999); // End of the payment day

  // If we haven't reached the payment deadline yet, check previous month status or just return 'Pendiente' if no payment this month?
  // Logic:
  // 1. If lastPaymentDate is in the current month, status is 'Al día'.
  // 2. If lastPaymentDate is NOT in current month:
  //    a. If today <= paymentDeadline: 'Pendiente' (Waiting for payment).
  //    b. If today > paymentDeadline: 'Vencido' (Overdue).

  if (prepaidUntil && prepaidUntil >= today) {
    return 'Al día';
  }

  if (lastPaymentDate) {
    const lastPaymentMonth = lastPaymentDate.getMonth();
    const lastPaymentYear = lastPaymentDate.getFullYear();

    if (lastPaymentMonth === currentMonth && lastPaymentYear === currentYear) {
      return 'Al día';
    }
  }

  if (today <= paymentDeadline) {
    return 'Pendiente';
  } else {
    return 'Vencido';
  }
};
