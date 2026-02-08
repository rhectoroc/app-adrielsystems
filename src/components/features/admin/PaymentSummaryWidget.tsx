import { useState, useEffect } from 'react';
import { AlertCircle, Clock, DollarSign, Loader2 } from 'lucide-react';
import { api } from '../../../utils/api';

interface PaymentSummary {
    overdue: { count: number; totalAmount: number };
    pending: { count: number; totalAmount: number };
    upcoming: { count: number; totalAmount: number };
}

export const PaymentSummaryWidget = () => {
    const [summary, setSummary] = useState<PaymentSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        try {
            const response = await api.get('/api/payments/summary');
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        } catch (error) {
            console.error('Error fetching payment summary:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-6 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overdue Payments */}
            <div className="glass-card p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <h3 className="text-sm font-medium text-gray-400">Morosos</h3>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-bold text-white">{summary.overdue.count}</p>
                    <p className="text-sm text-gray-500">
                        ${summary.overdue.totalAmount.toFixed(2)} en deuda
                    </p>
                </div>
            </div>

            {/* Pending Payments */}
            <div className="glass-card p-6 border-l-4 border-yellow-500">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-sm font-medium text-gray-400">Pendientes</h3>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-bold text-white">{summary.pending.count}</p>
                    <p className="text-sm text-gray-500">
                        ${summary.pending.totalAmount.toFixed(2)} total
                    </p>
                </div>
            </div>

            {/* Upcoming Payments (next 7 days) */}
            <div className="glass-card p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-medium text-gray-400">Próximos (7 días)</h3>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-bold text-white">{summary.upcoming.count}</p>
                    <p className="text-sm text-gray-500">
                        ${summary.upcoming.totalAmount.toFixed(2)} esperado
                    </p>
                </div>
            </div>
        </div>
    );
};
