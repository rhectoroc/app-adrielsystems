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
            const response = await api.get('/api/payments/upcoming?days=7');
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
            <div className="glass-card p-6 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-white">Próximos Vencimientos</h3>
                {upcomingPayments.length > 0 && (
                    <span className="ml-auto px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                        {upcomingPayments.length}
                    </span>
                )}
            </div>

            {upcomingPayments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <p>No hay pagos próximos en los siguientes 7 días</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {upcomingPayments.map((payment) => (
                        <div
                            key={payment.payment_id}
                            className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-500/40 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h4 className="font-medium text-white text-sm">{payment.client_name}</h4>
                                    <p className="text-xs text-gray-400">{payment.service_name}</p>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="font-bold text-white text-sm">
                                        {payment.currency} {payment.amount}
                                    </p>
                                    <div className="flex items-center justify-end gap-2">
                                        {payment.last_notification_date && (
                                            <div className="flex items-center gap-1 text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded text-[10px]" title="Notificación enviada hoy">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span className="hidden sm:inline">Enviado</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-blue-400">
                                            {payment.days_until_due === 0 ? 'Hoy' : `${payment.days_until_due}d`} • {formatDate(payment.due_date)}
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
