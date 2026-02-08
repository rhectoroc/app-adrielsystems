
import { Users, DollarSign, AlertCircle } from 'lucide-react';

export const AdminDashboard = () => {
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
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-primary transition-colors">12</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Users className="w-6 h-6" />
                    </div>
                </div>

                {/* Metric Card 2 */}
                <div className="glass-card flex items-center justify-between group hover:border-secondary/30 transition-all">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400">Monthly Revenue</h3>
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-secondary transition-colors">$1,200</p>
                    </div>
                    <div className="p-3 bg-secondary/10 rounded-full text-secondary">
                        <DollarSign className="w-6 h-6" />
                    </div>
                </div>

                {/* Metric Card 3 */}
                <div className="glass-card flex items-center justify-between group hover:border-red-500/30 transition-all">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400">Pending Payments</h3>
                        <p className="mt-2 text-3xl font-bold text-white group-hover:text-red-500 transition-colors">3</p>
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
