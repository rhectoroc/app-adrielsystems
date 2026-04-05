
import { useState, useEffect } from 'react';
import { Users, DollarSign, AlertCircle, Loader2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { PaymentSummaryWidget } from '../../components/features/admin/PaymentSummaryWidget';
import { OverdueClientsWidget } from '../../components/features/admin/OverdueClientsWidget';
import { UpcomingPaymentsWidget } from '../../components/features/admin/UpcomingPaymentsWidget';
import { SentMessagesWidget } from '../../components/features/admin/SentMessagesWidget';

export const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalClients: 0,
        grossRevenue: 0,
        pendingPayments: 0
    });
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Stats from the new optimized endpoint
                const statsRes = await api.get('/api/stats');
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                }

                // 2. Fetch Activity
                const activityRes = await api.get('/api/activity');
                if (activityRes.ok) {
                    const activityData = await activityRes.json();
                    setActivities(activityData);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="pb-4 border-b border-white/10">
                <h1 className="text-xl font-heading font-bold text-white tracking-wide">Panel de Administración</h1>
                <p className="text-gray-400 text-xs mt-0.5">Resumen del sistema y métricas clave.</p>
            </div>

            {/* Metric Card Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Metric Card 1 */}
                <div className="glass-card flex items-center justify-between group hover:border-primary/30 transition-all py-3">
                    <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-medium text-gray-400">Total Clientes</h3>
                        <p className="mt-1 text-2xl font-bold text-white group-hover:text-primary transition-colors">{stats.totalClients}</p>
                    </div>
                    <div className="p-2.5 bg-primary/10 rounded-full text-primary">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                {/* Metric Card 2 */}
                <div className="glass-card flex items-center justify-between group hover:border-secondary/30 transition-all py-3">
                    <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-medium text-gray-400">Ingresos Totales</h3>
                        <p className="mt-1 text-2xl font-bold text-white group-hover:text-secondary transition-colors">${(stats.grossRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 bg-secondary/10 rounded-full text-secondary">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>

                {/* Metric Card 3 */}
                <div className="glass-card flex items-center justify-between group hover:border-red-500/30 transition-all py-3">
                    <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-medium text-gray-400">Pagos Pendientes</h3>
                        <p className="mt-1 text-2xl font-bold text-white group-hover:text-red-500 transition-colors">{stats.pendingPayments}</p>
                    </div>
                    <div className="p-2.5 bg-red-500/10 rounded-full text-red-500">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Payment Summary Widgets */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest opacity-80">Resumen de Pagos</h2>
                <PaymentSummaryWidget />
            </div>

            {/* Payment Details Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <OverdueClientsWidget />
                <UpcomingPaymentsWidget />
            </div>

            {/* Bottom Row - Activity and Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Activity */}
                <div className="glass-card p-4 h-full">
                    <h3 className="text-sm font-heading font-semibold text-gray-100 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Actividad del Sistema
                    </h3>
                    <div className="space-y-3">
                        {activities.length === 0 ? (
                            <div className="text-gray-400 text-xs italic py-10 text-center">No hay registros de actividad reciente.</div>
                        ) : (
                            activities.map((activity, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px] border-b border-white/5 pb-2 last:border-0 last:pb-0 group">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <Link 
                                            to={`/admin/payments?clientId=${activity.client_id || (activity.client_name ? `?search=${activity.client_name}` : '')}`}
                                            className="text-white font-black uppercase tracking-tight hover:text-primary transition-colors truncate"
                                        >
                                            {activity.client_name}
                                        </Link>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1">
                                            {activity.type === 'PAYMENT' ? (
                                                <DollarSign className="w-2 h-2 text-green-500" />
                                            ) : (
                                                <Send className="w-2 h-2 text-blue-500" />
                                            )}
                                            {activity.type === 'PAYMENT' ? `Pago: ${activity.detail}` : `Notif: ${activity.detail}`}
                                        </span>
                                    </div>
                                    <div className="text-right ml-2">
                                        {activity.amount && (
                                            <div className="text-primary font-black">{activity.currency} {activity.amount}</div>
                                        )}
                                        <div className="text-[9px] text-gray-600 font-bold">
                                            {new Date(activity.activity_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sent Messages Widget */}
                <SentMessagesWidget />
            </div>
        </div>
    );
};
