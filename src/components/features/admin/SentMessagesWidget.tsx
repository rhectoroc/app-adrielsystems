import { useState, useEffect } from 'react';
import { Mail, MessageSquare, CheckCircle2, XCircle, Clock, Loader2, Send } from 'lucide-react';
import { api } from '../../../utils/api';
import { getTimeAgo } from '../../../utils/dateUtils';

interface NotificationLog {
    id: number;
    type: string;
    channel: string;
    status: string;
    sent_at: string;
    client_id: number;
    client_name: string;
    client_email: string;
    client_phone: string;
}

export const SentMessagesWidget = () => {
    const [logs, setLogs] = useState<NotificationLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
        // Refresh every 5 minutes
        const interval = setInterval(fetchLogs, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const response = await api.get('/api/notifications/log?limit=10');
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            }
        } catch (error) {
            console.error('Error fetching notification logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel.toLowerCase()) {
            case 'whatsapp':
            case 'phone':
                return <MessageSquare className="w-3 h-3 text-green-500" />;
            case 'email':
            case 'mail':
                return <Mail className="w-3 h-3 text-blue-500" />;
            default:
                return <Send className="w-3 h-3 text-gray-400" />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toUpperCase()) {
            case 'SENT':
            case 'ENVIADO':
            case 'SUCCESS':
                return <CheckCircle2 className="w-3 h-3 text-green-500" />;
            case 'FAILED':
            case 'ERROR':
                return <XCircle className="w-3 h-3 text-red-500" />;
            case 'PENDING':
            case 'PENDIENTE':
                return <Clock className="w-3 h-3 text-yellow-500" />;
            default:
                return null;
        }
    };

    const getNotificationTypeDisplay = (type: string) => {
        switch (type.toLowerCase()) {
            case 'overdue':
            case 'vencido':
                return 'Cobro Vencido';
            case 'upcoming':
            case 'por_vencer':
                return 'Aviso de Vencimiento';
            case 'due_today':
                return 'Vence Hoy';
            default:
                return type;
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
        <div className="glass-card p-4 border border-white/5 bg-white/[0.01] h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Notificaciones Enviadas</h3>
                <span className="ml-auto text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Últimos 10</span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 italic text-xs">
                        <p>No hay registros de envíos recientes.</p>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div 
                            key={log.id}
                            className="p-2.5 bg-white/[0.02] rounded border border-white/5 hover:border-primary/20 transition-all flex items-start gap-4 group"
                        >
                            <div className="pt-0.5">
                                <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5 group-hover:bg-white/[0.05]">
                                    {getChannelIcon(log.channel)}
                                </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-[12px] font-black text-white uppercase tracking-tight truncate">
                                        {log.client_name}
                                    </span>
                                    <span className="text-[9px] text-gray-500 font-bold whitespace-nowrap">
                                        {getTimeAgo(log.sent_at)}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter truncate">
                                        {getNotificationTypeDisplay(log.type)}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/5">
                                        {getStatusIcon(log.status)}
                                        <span className={`text-[8px] font-black uppercase ${
                                            log.status.toUpperCase() === 'FAILED' ? 'text-red-500' : 
                                            log.status.toUpperCase() === 'SENT' ? 'text-green-500' : 'text-gray-400'
                                        }`}>
                                            {log.status === 'SENT' ? 'Enviado' : log.status === 'FAILED' ? 'Fallido' : log.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {logs.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 text-center">
                    <button className="text-[10px] text-primary font-black uppercase tracking-widest hover:opacity-80 transition-opacity">
                        Ver todo el historial
                    </button>
                </div>
            )}
        </div>
    );
};
