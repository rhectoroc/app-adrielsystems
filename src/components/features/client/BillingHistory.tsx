
// Mock data
const mockPayments = [
    { id: '101', date: '2026-02-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
    { id: '102', date: '2026-01-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
    { id: '103', date: '2025-12-15', amount: 45.00, status: 'PAID', description: 'Monthly Hosting & Support' },
];

export const BillingHistory = () => {
    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Billing History</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 font-medium">Amount</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Receipt</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700">
                        {mockPayments.map((payment) => (
                            <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3">{payment.date}</td>
                                <td className="px-4 py-3">{payment.description}</td>
                                <td className="px-4 py-3 font-medium">${payment.amount.toFixed(2)}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button className="text-blue-600 hover:text-blue-800 hover:underline">
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
