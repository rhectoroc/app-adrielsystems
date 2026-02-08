
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ServiceStatus, Service } from '../../components/features/client/ServiceStatus';
import { PaymentStatusCard } from '../../components/features/client/PaymentStatus';
import { BillingHistory, Payment } from '../../components/features/client/BillingHistory';
import { SupportWidget } from '../../components/features/client/SupportWidget';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';

export const ClientDashboard = () => {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.client_id) return;

            try {
                setLoading(true);
                // 1. Fetch Client Profile (optional, to ensure we have latest data)
                // const profileRes = await api.get('/client/me');

                // 2. Fetch Services
                const servicesRes = await api.get(`/clients/${user.client_id}/services`);
                const servicesData = await servicesRes.json();
                setServices(servicesData);

                // 3. Fetch Payments
                const paymentsRes = await api.get(`/payments/client/${user.client_id}`);
                const paymentsData = await paymentsRes.json();
                setPayments(paymentsData);

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                toast.error('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        if (user?.client_id) {
            fetchDashboardData();
        }
    }, [user?.client_id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Determine primary service for Payment Status Card (assuming 1 main service for now)
    const primaryService = services[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white tracking-wide">
                        Welcome back, <span className="text-primary">{user?.name || 'Client'}</span>
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Here's an overview of your active services and billing status.
                    </p>
                </div>
                <span className="text-sm font-mono text-gray-500 px-3 py-1 bg-black/30 rounded-full border border-white/5">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>

            {/* Top Row: Service Status & Payment Status */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Service Status takes 2/3 width */}
                <div className="lg:col-span-2">
                    <ServiceStatus services={services} />
                </div>
                {/* Payment Status takes 1/3 width */}
                <div className="lg:col-span-1">
                    <PaymentStatusCard
                        paymentDay={primaryService?.renewal_day || 1}
                        lastPaymentDateString={primaryService ? (primaryService as any).last_payment_date : null}
                        currency={primaryService?.currency}
                        cost={primaryService?.cost}
                    />
                </div>
            </div>

            {/* Middle Row: Support Widget */}
            <div>
                <SupportWidget />
            </div>

            {/* Bottom Row: Billing History */}
            <div>
                <BillingHistory payments={payments} />
            </div>
        </div>
    );
};
