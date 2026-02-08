
export interface Payment {
    id: string;
    payment_date: string;
    amount: number;
    currency: string;
    status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
    service_name: string;
    notes?: string;
}

interface BillingHistoryProps {
    payments: Payment[];
}

export const BillingHistory = ({ payments }: BillingHistoryProps) => {
    return (
        <div className="glass-card">
            <h2 className="mb-4 text-lg font-heading font-semibold text-gray-100">Billing History</h2>
            {payments.length === 0 ? (
                <p className="text-gray-400">No payment history found.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-sm text-gray-400 border-b border-white/10">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Description</th>
                                <th className="px-4 py-3 font-medium">Amount</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300">
                            {payments.map((payment) => (
                                <tr key={payment.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 text-gray-400">
                                        {new Date(payment.payment_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">{payment.service_name || 'Service Payment'}</td>
                                    <td className="px-4 py-3 font-medium text-white">{payment.currency} {Number(payment.amount).toFixed(2)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${payment.status === 'PAGADO'
                                                ? 'bg-green-900/50 text-green-400 border-green-500/20'
                                                : payment.status === 'VENCIDO'
                                                    ? 'bg-red-900/50 text-red-400 border-red-500/20'
                                                    : 'bg-yellow-900/50 text-yellow-400 border-yellow-500/20'
                                            }`}>
                                            {payment.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {payment.notes}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
