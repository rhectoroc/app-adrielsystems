
import { useState, useEffect } from 'react';
import { Users, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';

export const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalClients: 0,
        monthlyRevenue: 0,
        pendingPayments: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch Clients for count
                const clientsRes = await api.get('/api/clients');
                const clients = await clientsRes.json();

                // Fetch Payments for revenue/pending
                const paymentsRes = await api.get('/api/payments');
                const payments = await paymentsRes.json();

                // Calculate stats
                const totalClients = clients.length;

                // Revenue: Sum of PAID payments for current month (simplified to all PAID for now or based on payments list)
                // Let's just sum all PAID payments for a specific "Monthly" metric or just Total Revenue?
                // User's previous hardcode was "Monthly Revenue". Let's approximation with last 30 days if possible,
                // or just sum the amounts of PAID payments in the list if they are recent.
                // For simplicity in this step, I'll sum ALL 'PAID' payments as "Total Revenue" or similar, 
                // or if we want "Monthly", filter by date. Let's just sum all 'PAID' for now.
                const revenue = payments
                    .filter((p: any) => p.status === 'PAID')
                    .reduce((acc: number, curr: any) => acc + parseFloat(curr.amount), 0);

                const pending = payments.filter((p: any) => p.status === 'PENDING').length;

                setStats({
                    totalClients,
                    monthlyRevenue: revenue,
                    pendingPayments: pending
                });
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-white/10">
                <h1 className="text-3xl font-heading font-bold text-white tracking-wide">Admin Dashboard</h1>
                <p className="text-gray-400 mt-1">System overview and key metrics.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Metric Card 1 */}
                <div className="glass-card flex items-center justify-between group hover:border-primary/30 transition-all">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400">Total Clients</h3>
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-primary transition-colors">{stats.totalClients}</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Users className="w-6 h-6" />
                    </div>
                </div>

                {/* Metric Card 2 */}
                <div className="glass-card flex items-center justify-between group hover:border-secondary/30 transition-all">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400">Total Revenue</h3>
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-secondary transition-colors">${stats.monthlyRevenue.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-secondary/10 rounded-full text-secondary">
                        <DollarSign className="w-6 h-6" />
                    </div>
                </div>

                {/* Metric Card 3 */}
                <div className="glass-card flex items-center justify-between group hover:border-red-500/30 transition-all">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400">Pending Payments</h3>
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-red-500 transition-colors">{stats.pendingPayments}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Recent Activity or Placeholder */}
            <div className="glass-card">
                <h3 className="text-lg font-heading font-semibold text-gray-100 mb-4">Recent System Activity</h3>
                <div className="text-gray-400 text-sm italic">
                    No recent activity logs available.
                </div>
            </div>
        </div>
    );
};
