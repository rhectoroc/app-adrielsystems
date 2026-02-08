import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Phone, Mail } from 'lucide-react';
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
            <div className="glass-card p-6 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-white">Clientes Morosos</h3>
                {overdueClients.length > 0 && (
                    <span className="ml-auto px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                        {overdueClients.length}
                    </span>
                )}
            </div>

            {overdueClients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <p>🎉 No hay clientes morosos</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {overdueClients.map((client) => (
                        <div
                            key={client.payment_id}
                            className="p-4 bg-white/5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="font-medium text-white">{client.client_name}</h4>
                                    <p className="text-sm text-gray-400">{client.service_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-red-400">
                                        {client.currency} {client.amount}
                                    </p>
                                    <p className="text-xs text-red-500">
                                        {client.days_overdue} días vencido
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    <span>{client.client_email}</span>
                                </div>
                                {client.client_phone && (
                                    <div className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        <span>{client.client_phone}</span>
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
