import { useState, useEffect } from 'react';
import { Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../../utils/api';

interface UpcomingPayment {
    payment_id: number;
    client_id: number;
    client_name: string;
    service_name: string;
    amount: number;
    currency: string;
    due_date: string;
    days_until_due: number;
    last_notification_date?: string | null;
}

export const UpcomingPaymentsWidget = () => {
    const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUpcomingPayments();
    }, []);

    const fetchUpcomingPayments = async () => {
        try {
            const response = await api.get('/api/payments/upcoming?days=15');
            if (response.ok) {
                const data = await response.json();
                setUpcomingPayments(data);
            }
        } catch (error) {
            console.error('Error fetching upcoming payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="glass-card p-4 flex justify-center opacity-50">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="glass-card p-4 border border-white/5 bg-white/[0.01]">
            <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Cobros Próximos</h3>
                {upcomingPayments.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded border border-blue-500/10">
                        {upcomingPayments.length}
                    </span>
                )}
            </div>

            {upcomingPayments.length === 0 ? (
                <div className="text-center py-6 text-gray-600 italic text-xs">
                    <p>No se registran vencimientos cercanos.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {upcomingPayments.map((payment) => (
                        <div
                            key={payment.payment_id}
                            className="p-3 bg-white/[0.02] rounded border border-white/5 hover:border-blue-500/20 transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 pr-2">
                                    <h4 className="text-[13px] font-black text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{payment.client_name}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{payment.service_name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-white">
                                        {payment.currency} {payment.amount}
                                    </p>
                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                        {payment.last_notification_date && (
                                            <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-1 py-0.5 rounded text-[8px] font-black border border-green-500/10" title="Notificación enviada">
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                <span>ENV.</span>
                                            </div>
                                        )}
                                        <p className="text-[9px] text-blue-400 font-black uppercase tracking-tighter">
                                            {payment.days_until_due === 0 ? 'HOY' : `${payment.days_until_due}D`} • {formatDate(payment.due_date)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
