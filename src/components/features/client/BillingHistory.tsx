
// Mock data
const mockPayments = [
    { id: '101', date: '2026-02-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
    { id: '102', date: '2026-01-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
    { id: '103', date: '2025-12-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
];

export const BillingHistory = () => {
    return (
        <div className="glass-card">
            <h2 className="mb-4 text-lg font-heading font-semibold text-gray-100">Billing History</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-sm text-gray-400 border-b border-white/10">
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 font-medium">Amount</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Receipt</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-300">
                        {mockPayments.map((payment) => (
                            <tr key={payment.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-gray-400">{payment.date}</td>
                                <td className="px-4 py-3">{payment.description}</td>
                                <td className="px-4 py-3 font-medium text-white">${payment.amount.toFixed(2)}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-500/20">
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button className="text-primary hover:text-primary/80 hover:underline">
                                        Download
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
