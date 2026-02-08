
import { getPaymentStatus } from '../../../utils/paymentStatus';

interface PaymentStatusCardProps {
    paymentDay: number;
    lastPaymentDateString: string | null; // Pass as string (e.g. '2025-05-15') to simplify props
}

export const PaymentStatusCard = ({ paymentDay, lastPaymentDateString }: PaymentStatusCardProps) => {
    const lastPaymentDate = lastPaymentDateString ? new Date(lastPaymentDateString) : null;
    const status = getPaymentStatus(paymentDay, lastPaymentDate);

    // Color Logic
    const getColor = () => {
        switch (status) {
            case 'Al día': return 'bg-green-500';
            case 'Pendiente': return 'bg-yellow-500';
            case 'Vencido': return 'bg-red-500';
            default: return 'bg-gray-300';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Your Payment Status</h2>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-lg ${getColor()}`}>
                <span className="text-xl font-bold text-white uppercase">{status}</span>
            </div>
            <div className="text-center text-gray-600">
                <p className="mb-1">Payment Day: <strong>{paymentDay}th of each month</strong></p>
                {lastPaymentDate && (
                    <p className="text-sm">Last Payment: {lastPaymentDate.toLocaleDateString()}</p>
                )}
                {!lastPaymentDate && (
                    <p className="text-sm">Last Payment: Never</p>
                )}
            </div>
            {status !== 'Al día' && (
                <button className="px-4 py-2 mt-4 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    Pay Now
                </button>
            )}
        </div>
    );
};
