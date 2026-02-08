
import { getPaymentStatus } from '../../../utils/paymentStatus';

interface PaymentStatusCardProps {
    paymentDay: number;
    lastPaymentDateString: string | null;
}

export const PaymentStatusCard = ({ paymentDay, lastPaymentDateString }: PaymentStatusCardProps) => {
    const lastPaymentDate = lastPaymentDateString ? new Date(lastPaymentDateString) : null;
    const status = getPaymentStatus(paymentDay, lastPaymentDate);

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
            <h2 className="mb-6 text-lg font-heading font-semibold text-gray-100">Payment Status</h2>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${getColor()}`}>
                <span className="text-xl font-bold text-black uppercase font-heading">{status}</span>
            </div>
            <div className="text-center text-gray-400">
                <p className="mb-1">Payment Day: <strong className="text-gray-200">{paymentDay}th of each month</strong></p>
                {lastPaymentDate && (
                    <p className="text-sm">Last Payment: {lastPaymentDate.toLocaleDateString()}</p>
                )}
                {!lastPaymentDate && (
                    <p className="text-sm">Last Payment: Never</p>
                )}
            </div>
            {status !== 'Al día' && (
                <button className="px-6 py-2 mt-6 font-semibold text-white bg-primary rounded-md hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                    Pay Now
                </button>
            )}
        </div>
    );
};
