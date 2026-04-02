import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '../../../utils/api';

interface OverdueClient {
    payment_id: number;
    client_id: number;
    client_name: string;
    client_email: string;
    client_phone: string;
    service_name: string;
    amount: number;
    currency: string;
    due_date: string;

    days_overdue: number;
    last_notification_date?: string | null;
}

export const OverdueClientsWidget = () => {
    const [overdueClients, setOverdueClients] = useState<OverdueClient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverdueClients();
    }, []);

    const fetchOverdueClients = async () => {
        try {
            const response = await api.get('/api/payments/overdue');
            if (response.ok) {
                const data = await response.json();
                setOverdueClients(data);
            }
        } catch (error) {
            console.error('Error fetching overdue clients:', error);
        } finally {
            setLoading(false);
        }
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
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Mora Crítica</h3>
                {overdueClients.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-black rounded border border-red-500/10">
                        {overdueClients.length}
                    </span>
                )}
            </div>

            {overdueClients.length === 0 ? (
                <div className="text-center py-6 text-gray-600 italic text-xs">
                    <p>No se registran deudas pendientes.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {overdueClients.map((client) => (
                        <div
                            key={client.payment_id}
                            className="p-3 bg-white/[0.02] rounded border border-white/5 hover:border-red-500/20 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-1.5">
                                <div className="min-w-0">
                                    <h4 className="text-[13px] font-black text-white truncate group-hover:text-red-400 transition-colors uppercase tracking-tight">{client.client_name}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{client.service_name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-red-500">
                                        {client.currency} {client.amount}
                                    </p>
                                    <p className="text-[9px] text-red-500/60 font-black uppercase tracking-tighter">
                                        {client.days_overdue} DÍAS VENC.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-600 font-bold uppercase tracking-tighter">
                                <div className="flex items-center gap-1 min-w-0">
                                    <Mail className="w-2.5 h-2.5 opacity-50 shrink-0" />
                                    <span className="truncate">{client.client_email}</span>
                                </div>
                                {client.client_phone && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Phone className="w-2.5 h-2.5 opacity-50 shrink-0" />
                                        <span>{client.client_phone}</span>
                                    </div>
                                )}
                                {client.last_notification_date && (
                                    <div className="flex items-center gap-1 ml-auto text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded text-[8px] font-black border border-green-500/10" title="Notificación enviada">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        <span>ENVIADO</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
