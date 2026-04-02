import { useState, useEffect } from 'react';
import { Search, Plus, Building, Mail, Loader2, Globe, Edit, Trash2, Ban, CheckCircle } from 'lucide-react';
import { api } from '../../../utils/api';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';

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
    const { confirm } = useConfirm();
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
        const isActivating = !client.is_active;
        const confirmed = await confirm({
            title: isActivating ? 'Habilitar Cliente' : 'Inhabilitar Cliente',
            message: `¿Estás seguro de que deseas ${isActivating ? 'habilitar' : 'inhabilitar'} a ${client.name}? ${!isActivating ? 'El cliente dejará de recibir notificaciones de cobro.' : ''}`,
            confirmText: isActivating ? 'Habilitar' : 'Inhabilitar',
            type: isActivating ? 'info' : 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await api.put(`/api/clients/${client.id}/status`, {
                is_active: !client.is_active
            });

            if (response.ok) {
                // Update local state optimizing for speed
                setClients(prev => prev.map(c =>
                    c.id === client.id ? { ...c, is_active: !c.is_active } : c
                ));
                toast.success(`Cliente ${isActivating ? 'habilitado' : 'inhabilitado'} exitosamente`);
            }
        } catch (error) {
            console.error('Error toggling client status:', error);
            toast.error('Error al cambiar el estado del cliente');
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.domain?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Filtrar por nombre, empresa, email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs focus:outline-none focus:border-primary/50 text-white placeholder-gray-600"
                    />
                </div>
                <button
                    onClick={onAddClick}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-[11px] font-black uppercase tracking-wider"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Cliente
                </button>
            </div>

            <div className="glass-card overflow-hidden p-0 border border-white/5">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 border-b border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            <tr>
                                <th className="p-3 w-[25%] font-black italic">Cliente / Empresa</th>
                                <th className="p-3 w-[25%] font-black italic">Contacto & Red</th>
                                <th className="p-3 w-[20%] font-black italic">Servicio(s)</th>
                                <th className="p-3 w-[15%] font-black italic text-right">Inversión</th>
                                <th className="p-3 w-[15%] font-black italic text-right whitespace-nowrap">Estado / Gestión</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando base de datos...</span>
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-gray-500 italic text-xs">
                                        No se localizaron registros coincidentes.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className={`transition-colors border-b border-white/5 last:border-0 hover:bg-white/[0.02] ${client.is_active === false ? 'opacity-60 grayscale-[80%]' : ''}`}>
                                        <td className="p-3 align-top min-w-[200px]">
                                            <div className="flex flex-col">
                                                <div className="font-black text-white text-sm group-hover:text-primary transition-colors truncate" title={client.name}>{client.name}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-bold uppercase tracking-tighter">
                                                    <Building className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate" title={client.company_name || 'PARTICULAR'}>
                                                        {client.company_name || 'PARTICULAR'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2 text-[11px] text-gray-300">
                                                    <Mail className="w-2.5 h-2.5 text-gray-600 shrink-0" />
                                                    <span className="truncate max-w-[160px]" title={client.email || ''}>{client.email || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                                    <Globe className="w-2.5 h-2.5 text-gray-600 shrink-0" />
                                                    <span className="truncate max-w-[140px] italic" title={client.domain || ''}>{client.domain || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-[11px] text-white font-black truncate max-w-[150px]">{client.service_name || 'SIN PLAN ACTIVO'}</div>
                                                {client.services && client.services.length > 1 && (
                                                    <span className="text-[9px] text-primary/80 font-black uppercase bg-primary/10 px-1.5 py-0.5 rounded w-fit border border-primary/20">
                                                        +{client.services.length - 1} ADICIONAL(ES)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 align-top text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="text-sm font-black text-white">
                                                    ${(client.total_monthly || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">MENSUALIDAD</div>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <div className="mr-2">
                                                    {client.payment_status === 'OVERDUE' ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-500 border border-red-500/10 uppercase">MOROSO</span>
                                                    ) : client.payment_status === 'UPCOMING' ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/10 uppercase">PROXIMO</span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-green-500/20 text-green-500 border border-green-500/10 uppercase">AL DIA</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    <button
                                                        onClick={() => onEditClick(client)}
                                                        className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                        title="Configurar"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(client)}
                                                        className={`p-1 rounded transition-colors ${client.is_active === false ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-500 hover:text-red-500 hover:bg-red-500/10'}`}
                                                        title={client.is_active === false ? "Activar" : "Suspender"}
                                                    >
                                                        {client.is_active === false ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteClick(client)}
                                                        className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/20 rounded transition-colors"
                                                        title="Eliminar Permanente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
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
