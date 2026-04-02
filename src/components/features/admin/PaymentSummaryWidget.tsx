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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card p-3 flex justify-center opacity-50 border border-white/5 bg-white/[0.01]">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                ))}
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Overdue Payments */}
            <div className="glass-card p-3 border border-white/5 bg-white/[0.01] border-l-2 border-l-red-500/50">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">En Mora</h3>
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black text-white">{summary.overdue.count}</p>
                    <p className="text-[10px] text-red-500/60 font-bold uppercase tracking-tight">
                        ${summary.overdue.totalAmount.toLocaleString()} DEUDA
                    </p>
                </div>
            </div>

            {/* Pending Payments */}
            <div className="glass-card p-3 border border-white/5 bg-white/[0.01] border-l-2 border-l-amber-500/50">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pendientes</h3>
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black text-white">{summary.pending.count}</p>
                    <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-tight">
                        ${summary.pending.totalAmount.toLocaleString()} TOTAL
                    </p>
                </div>
            </div>

            {/* Upcoming Payments (next 7 days) */}
            <div className="glass-card p-3 border border-white/5 bg-white/[0.01] border-l-2 border-l-blue-500/50">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Próximos 7d</h3>
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black text-white">{summary.upcoming.count}</p>
                    <p className="text-[10px] text-blue-500/60 font-bold uppercase tracking-tight">
                        ${summary.upcoming.totalAmount.toLocaleString()} ESPERADO
                    </p>
                </div>
            </div>
        </div>
    );
};
