
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface Service {
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    type: 'HOSTING' | 'WEB' | 'N8N';
    renewalDate: string;
}

// Mock data - In a real app this would come from props or context
const mockServices: Service[] = [
    { id: '1', name: 'Premium Hosting', status: 'ACTIVE', type: 'HOSTING', renewalDate: '2026-03-01' },
    { id: '2', name: 'Corporate Website', status: 'ACTIVE', type: 'WEB', renewalDate: '2026-03-01' },
    { id: '3', name: 'n8n Automation Workflows', status: 'MAINTENANCE', type: 'N8N', renewalDate: '2026-02-15' },
];

const StatusIcon = ({ status }: { status: Service['status'] }) => {
    switch (status) {
        case 'ACTIVE':
            return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'MAINTENANCE':
            return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        case 'INACTIVE':
            return <XCircle className="w-5 h-5 text-red-500" />;
    }
};

export const ServiceStatus = () => {
    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Your Services Status</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockServices.map((service) => (
                    <div key={service.id} className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500 uppercase">{service.type}</span>
                            <StatusIcon status={service.status} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Status: <span className="font-medium">{service.status}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                            Renews: {service.renewalDate}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};
