import { useState, useEffect } from 'react';
import { Search, Plus, User, Building, Mail, Phone, Loader2, Globe, MapPin, Edit, Trash2, Ban, CheckCircle } from 'lucide-react';
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
    is_active?: boolean;
    // joined fields
    service_name?: string;
    service_status?: string;
    payment_status?: 'OVERDUE' | 'UPCOMING' | 'PAID';
    total_monthly?: number;
    services?: any[];
}

interface ClientsTableProps {
    onAddClick: () => void;
    onEditClick: (client: Client) => void;
    onDeleteClick: (client: Client) => void;
    refreshTrigger?: number;
}

export const ClientsTable = ({ onAddClick, onEditClick, onDeleteClick, refreshTrigger = 0 }: ClientsTableProps) => {
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

    const handleToggleStatus = async (client: Client) => {
        if (!confirm(`¿Estás seguro de que deseas ${client.is_active ? 'inhabilitar' : 'habilitar'} a ${client.name}?`)) return;

        try {
            const response = await api.put(`/api/clients/${client.id}/status`, {
                is_active: !client.is_active
            });

            if (response.ok) {
                // Update local state optimizing for speed
                setClients(prev => prev.map(c =>
                    c.id === client.id ? { ...c, is_active: !c.is_active } : c
                ));
            }
        } catch (error) {
            console.error('Error toggling client status:', error);
            alert('Error al cambiar el estado del cliente');
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
                <div className="w-full">
                    <table className="w-full text-left table-fixed">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium w-[25%]">Nombre/Empresa</th>
                                <th className="p-4 font-medium w-[20%]">Contacto</th>
                                <th className="p-4 font-medium w-[20%]">Ubicación/Dominio</th>
                                <th className="p-4 font-medium w-[15%]">Servicio(s)</th>
                                <th className="p-4 font-medium text-right w-[15%]">Mensualidad / Estado</th>
                                <th className="p-4 font-medium w-[5%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Cargando clientes...
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        No se encontraron clientes.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className={`transition-colors group border-b border-white/5 last:border-0 ${client.is_active === false ? 'bg-red-500/5 hover:bg-red-500/10 opacity-75 grayscale-[50%]' : 'hover:bg-white/5'}`}>
                                        <td className="p-4 align-top w-[25%]">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-white truncate" title={client.name}>{client.name}</div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                                        <Building className="w-3 h-3 shrink-0" />
                                                        <span className="truncate" title={client.company_name || 'Individual'}>
                                                            {client.company_name || 'Individual'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top w-[20%]">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Mail className="w-3 h-3 text-gray-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]" title={client.email || ''}>{client.email || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Phone className="w-3 h-3 text-gray-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]" title={client.phone || client.contact_info || ''}>{client.phone || client.contact_info || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top w-[20%]">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Globe className="w-3 h-3 text-gray-500 shrink-0" />
                                                    <span className="truncate max-w-[150px]" title={client.domain || ''}>{client.domain || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                                                    <span className="truncate max-w-[150px]" title={client.country || ''}>{client.country || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top w-[15%]">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-white font-medium">{client.service_name || 'Sin Servicio'}</span>
                                                {client.services && client.services.length > 1 && (
                                                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded w-fit">
                                                        +{client.services.length - 1} plan(es) más
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top text-right w-[15%]">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-sm font-bold text-white">
                                                    ${(client.total_monthly || 0).toLocaleString()}
                                                </div>
                                                {client.payment_status === 'OVERDUE' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/20 uppercase tracking-wide">
                                                        Vencido
                                                    </span>
                                                )}
                                                {client.payment_status === 'UPCOMING' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/20 uppercase tracking-wide">
                                                        Próximo
                                                    </span>
                                                )}
                                                {client.payment_status === 'PAID' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/20 uppercase tracking-wide">
                                                        Al día
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top text-right w-[5%]">
                                            <div className="flex flex-col items-end gap-2">
                                                <button
                                                    onClick={() => handleToggleStatus(client)}
                                                    className={`p-1.5 rounded-lg transition-colors ${client.is_active === false ? 'text-green-400 hover:bg-green-500/20' : 'text-red-400 hover:bg-red-500/20'}`}
                                                    title={client.is_active === false ? "Habilitar Cliente" : "Inhabilitar Cliente"}
                                                >
                                                    {client.is_active === false ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => onEditClick(client)}
                                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Editar Cliente"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteClick(client)}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar Cliente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
