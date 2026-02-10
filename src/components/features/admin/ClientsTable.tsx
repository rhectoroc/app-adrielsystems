import { useState, useEffect } from 'react';
import { Search, Plus, User, Building, Mail, Phone, Loader2, Globe, MapPin, Edit } from 'lucide-react';
import { api } from '../../../utils/api';

interface Client {
    id: number;
    name: string;
    company_name: string;
    email: string;
    phone: string;
    domain: string;
    country: string;
    contact_info: string;
    created_at: string;
    // joined fields
    service_name?: string;
    service_status?: string;
    payment_status?: 'OVERDUE' | 'UPCOMING' | 'PAID';
}

interface ClientsTableProps {
    onAddClick: () => void;
    onEditClick: (client: Client) => void;
    refreshTrigger?: number;
}

export const ClientsTable = ({ onAddClick, onEditClick, refreshTrigger = 0 }: ClientsTableProps) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchClients();
    }, [refreshTrigger]);

    const fetchClients = async () => {
        try {
            const response = await api.get('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(data);
                // Debug log
                console.log('Fetched clients:', data);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.domain?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar clientes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 text-white placeholder-gray-500"
                    />
                </div>
                <button
                    onClick={onAddClick}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Agregar Cliente
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-sm">
                                <th className="p-4 font-medium">Nombre/Empresa</th>
                                <th className="p-4 font-medium">Contacto</th>
                                <th className="p-4 font-medium">Ubicación/Dominio</th>
                                <th className="p-4 font-medium">Servicio</th>
                                <th className="p-4 font-medium">Estado Servicio</th>
                                <th className="p-4 font-medium">Registrado</th>
                                <th className="p-4 font-medium w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Cargando clientes...
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        No se encontraron clientes.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{client.name}</div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Building className="w-3 h-3" />
                                                        {client.company_name || 'Individual'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Mail className="w-3 h-3 text-gray-500" />
                                                    {client.email || '-'}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Phone className="w-3 h-3 text-gray-500" />
                                                    {client.phone || client.contact_info || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Globe className="w-3 h-3 text-gray-500" />
                                                    {client.domain || '-'}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <MapPin className="w-3 h-3 text-gray-500" />
                                                    {client.country || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-white">{client.service_name || 'Sin Servicio'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {client.payment_status === 'OVERDUE' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                                    Vencido
                                                </span>
                                            )}
                                            {client.payment_status === 'UPCOMING' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                    Próximo
                                                </span>
                                            )}
                                            {client.payment_status === 'PAID' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                                    Al día
                                                </span>
                                            )}
                                            {!client.payment_status && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {new Date(client.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => onEditClick(client)}
                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
