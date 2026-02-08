import { useState, useEffect } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Calendar, Loader2 } from 'lucide-react';

interface Payment {
    id: number;
    amount: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    payment_date: string;
    service_month: string;
    client_name: string;
    company_name: string;
    n8n_reference_id?: string;
}

export const PaymentsOverview = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/payments');
            if (response.ok) {
                const data = await response.json();
                setPayments(data);
            }
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'text-secondary bg-secondary/10 border-secondary/20';
            case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'OVERDUE': return 'text-red-400 bg-red-400/10 border-red-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    const filteredPayments = payments.filter(payment => {
        const matchesSearch =
            payment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.amount.includes(searchTerm);

        const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const totalRevenue = payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const pendingAmount = payments
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Payments Overview</h2>
                    <p className="text-gray-400">Track and manage client payments.</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 text-sm">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 space-y-2">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-400 text-sm font-medium">Total Revenue</p>
                        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                            <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 space-y-2">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-400 text-sm font-medium">Pending Payments</p>
                        <div className="p-2 bg-yellow-400/10 rounded-lg text-yellow-400">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-white">${pendingAmount.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 space-y-2">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-400 text-sm font-medium">Overdue</p>
                        <div className="p-2 bg-red-400/10 rounded-lg text-red-400">
                            <ArrowDownLeft className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        ${payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search payments..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 text-white placeholder-gray-500"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                        <Filter className="w-4 h-4 text-gray-400" />
                        {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${statusFilter === status
                                        ? 'bg-primary/20 text-primary border-primary/50'
                                        : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-sm">
                                    <th className="p-4 font-medium">Client</th>
                                    <th className="p-4 font-medium">Amount</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Service Month</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Loading payments...
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">
                                            No payments found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-white/5 transition-colors text-sm">
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-medium text-white">{payment.client_name}</p>
                                                    <p className="text-xs text-gray-500">{payment.company_name}</p>
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-white">
                                                ${parseFloat(payment.amount).toFixed(2)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                                                    {payment.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-400">
                                                {new Date(payment.payment_date).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-gray-400">
                                                {new Date(payment.service_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
