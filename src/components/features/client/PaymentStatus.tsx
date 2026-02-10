import { getPaymentStatus } from '../../../utils/paymentStatus';

interface PaymentStatusCardProps {
    paymentDay: number;
    lastPaymentDateString: string | null;
    currency?: string;
    cost?: number;
    prepaidUntilString?: string | null;
}

export const PaymentStatusCard = ({
    paymentDay,
    lastPaymentDateString,
    currency = 'USD',
    cost = 0,
    prepaidUntilString
}: PaymentStatusCardProps) => {
    const lastPaymentDate = lastPaymentDateString ? new Date(lastPaymentDateString) : null;
    const prepaidUntil = prepaidUntilString ? new Date(prepaidUntilString) : null;

    // Status Calculation
    const status = getPaymentStatus(paymentDay, lastPaymentDate, new Date(), prepaidUntil);
    const today = new Date();

    // Calculate next due date
    let nextDueDate = new Date();
    nextDueDate.setDate(paymentDay);
    if (today.getDate() > paymentDay) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }

    // Adjust if last payment was recent (simple logic, should be robust in backend but good for visual)
    if (status === 'Al día' && lastPaymentDate) {
        // If paid, next due is next month from last payment? 
        // Or simply the next occurrence of paymentDay.
    }

    // Color Logic
    const getColor = () => {
        switch (status) {
            case 'Al día': return 'bg-secondary shadow-[0_0_20px_rgba(0,255,128,0.4)]';
            case 'Pendiente': return 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]';
            case 'Vencido': return 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]';
            default: return 'bg-gray-700';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center glass-card h-full">
            <h2 className="mb-6 text-lg font-heading font-semibold text-gray-100">Estado de Pago</h2>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${getColor()}`}>
                <span className="text-xl font-bold text-black uppercase font-heading">{status}</span>
            </div>
            <div className="text-center text-gray-400">
                <p className="mb-1">Día de Pago: <strong className="text-gray-200">{paymentDay} de cada mes</strong></p>
                {lastPaymentDate ? (
                    <p className="text-sm">Último Pago: {lastPaymentDate.toLocaleDateString()}</p>
                ) : (
                    <p className="text-sm">Último Pago: Nunca</p>
                )}
                <div className="mt-4 pt-4 border-t border-white/10 w-full">
                    <p className="text-sm text-gray-500">Monto de Suscripción</p>
                    <p className="text-xl font-bold text-white">{currency} {cost}</p>
                </div>
            </div>
            {status !== 'Al día' && (
                <button className="px-6 py-2 mt-6 font-semibold text-white bg-primary rounded-md hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                    Pagar Ahora
                </button>
            )}
        </div>
    );
};
