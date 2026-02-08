
import { ServiceStatus } from '../../components/features/client/ServiceStatus';
import { PaymentStatusCard } from '../../components/features/client/PaymentStatus';
import { BillingHistory } from '../../components/features/client/BillingHistory';
import { SupportWidget } from '../../components/features/client/SupportWidget';
import { useAuth } from '../../context/AuthContext';

export const ClientDashboard = () => {
    const { user } = useAuth();
    // Default or fetched data
    const clientPaymentDay = 5;
    const lastPaymentDate = '2026-01-05'; // Example: Paid last month

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                    Welcome back, {user?.name || 'Client'}!
                </h1>
                <span className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>

            {/* Top Row: Service Status & Payment Status */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Service Status takes 2/3 width */}
                <div className="lg:col-span-2">
                    <ServiceStatus />
                </div>
                {/* Payment Status takes 1/3 width */}
                <div className="lg:col-span-1">
                    <PaymentStatusCard
                        paymentDay={clientPaymentDay}
                        lastPaymentDateString={lastPaymentDate}
                    />
                </div>
            </div>

            {/* Middle Row: Support Widget */}
            <div>
                <SupportWidget />
            </div>

            {/* Bottom Row: Billing History */}
            <div>
                <BillingHistory />
            </div>
        </div>
    );
};
