
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export interface Service {
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    cost: number;
    currency: string;
    renewal_day: number;
}

const StatusIcon = ({ status }: { status: Service['status'] }) => {
    switch (status) {
        case 'ACTIVE':
            return <CheckCircle className="w-5 h-5 text-secondary" />; // Neon Green
        case 'MAINTENANCE':
            return <AlertCircle className="w-5 h-5 text-yellow-400" />;
        case 'INACTIVE':
            return <XCircle className="w-5 h-5 text-red-500" />;
        default:
            return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
};

interface ServiceStatusProps {
    services: Service[];
}

export const ServiceStatus = ({ services }: ServiceStatusProps) => {
    return (
        <div className="glass-card">
            <h2 className="mb-4 text-lg font-heading font-semibold text-gray-100">Your Services Status</h2>
            {services.length === 0 ? (
                <p className="text-gray-400">No active services found.</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <div key={service.id} className="p-4 border border-white/10 rounded-lg bg-black/20 hover:bg-black/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-primary uppercase tracking-wider">Service</span>
                                <StatusIcon status={service.status} />
                            </div>
                            <h3 className="text-lg font-bold text-white">{service.name}</h3>
                            <p className="mt-2 text-sm text-gray-400">
                                Status: <span className="font-medium text-gray-200">{service.status}</span>
                            </p>
                            <p className="text-sm text-gray-500">
                                Renews: Day {service.renewal_day} of month
                            </p>
                            <p className="text-sm text-secondary mt-1">
                                {service.currency} {service.cost}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
