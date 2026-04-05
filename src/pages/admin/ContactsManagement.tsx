import { useState, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    MessageSquare, 
    Send, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    Loader2, 
    Check, 
    X,
    UserCheck,
    UserMinus,
    ExternalLink
} from 'lucide-react';
import { api } from '../../utils/api';
import { getTimeAgo } from '../../utils/dateUtils';
import { MessageModal } from '../../components/features/admin/MessageModal';
import { toast } from 'sonner';

interface Contact {
    id: number;
    name: string;
    email: string;
    phone: string;
    is_active: boolean;
    monthly_revenue: string | number;
    services_count: number;
    last_contact: string | null;
    total_debt: string | number;
    status: 'PAID' | 'OVERDUE';
}

export const ContactsManagement = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'OVERDUE'>('ALL');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'SINGLE' | 'BULK' | 'TEST'>('SINGLE');
    const [targetClients, setTargetClients] = useState<Contact[]>([]);

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/contacts/status');
            if (response.ok) {
                const data = await response.json();
                setContacts(data);
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Error al cargar contactos');
        } finally {
            setLoading(false);
        }
    };

    const filteredContacts = contacts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             c.phone?.includes(searchTerm);
        const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredContacts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredContacts.map(c => c.id));
        }
    };

    const toggleSelectOne = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleOpenMessageModal = (mode: 'SINGLE' | 'BULK' | 'TEST', client?: Contact) => {
        setModalMode(mode);
        if (mode === 'SINGLE' && client) {
            setTargetClients([client]);
        } else if (mode === 'BULK') {
            const selected = contacts.filter(c => selectedIds.includes(c.id));
            setTargetClients(selected);
        } else if (mode === 'TEST') {
            // For test mode, we might use a dummy client object or the first one
            setTargetClients(contacts.length > 0 ? [contacts[0]] : []);
        }
        setIsModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="pb-4 border-b border-white/10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-heading font-bold text-white tracking-wide">Gestión de Contactos</h1>
                    <p className="text-gray-400 text-xs mt-0.5">Dashboard especializado para comunicación personalizada.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleOpenMessageModal('TEST')}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Prueba de Envío
                    </button>
                    
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={() => handleOpenMessageModal('BULK')}
                            className="btn-primary px-4 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Mensaje Masivo ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, email o teléfono..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
                    {(['ALL', 'PAID', 'OVERDUE'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`flex-1 py-1 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                                statusFilter === s ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {s === 'ALL' ? 'Todos' : s === 'PAID' ? 'Al día' : 'Morosos'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-end gap-4 px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            {contacts.filter(c => c.status === 'PAID').length} Al día
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            {contacts.filter(c => c.status === 'OVERDUE').length} Morosos
                        </span>
                    </div>
                </div>
            </div>

            {/* Contacts Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="p-4 text-left w-10">
                                    <button 
                                        onClick={toggleSelectAll}
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                            selectedIds.length === filteredContacts.length && filteredContacts.length > 0
                                            ? 'bg-primary border-primary text-black' 
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                    >
                                        {selectedIds.length === filteredContacts.length && filteredContacts.length > 0 && <Check className="w-3 h-3 stroke-[4]" />}
                                    </button>
                                </th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-left">Cliente</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-left">Estado / Deuda</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-left">Último Contacto</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500 italic">
                                        No se encontraron contactos que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-4">
                                            <button 
                                                onClick={() => toggleSelectOne(contact.id)}
                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                    selectedIds.includes(contact.id)
                                                    ? 'bg-primary border-primary text-black' 
                                                    : 'border-white/10 hover:border-white/30'
                                                }`}
                                            >
                                                {selectedIds.includes(contact.id) && <Check className="w-3 h-3 stroke-[4]" />}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border ${
                                                    contact.status === 'OVERDUE' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-primary/10 border-primary/20 text-primary'
                                                }`}>
                                                    {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white leading-none mb-1">{contact.name}</div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                        <span>{contact.phone || 'Sin teléfono'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                                        <span className="truncate max-w-[150px]">{contact.email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter w-fit ${
                                                    contact.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400 border border-red-500/10' : 'bg-green-500/20 text-green-400 border border-green-500/10'
                                                }`}>
                                                    {contact.status === 'OVERDUE' ? <AlertCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                                    {contact.status === 'OVERDUE' ? 'Vencido' : 'Al día'}
                                                </div>
                                                {parseFloat(contact.total_debt.toString()) > 0 && (
                                                    <div className="text-xs font-black text-red-500">
                                                        ${parseFloat(contact.total_debt.toString()).toLocaleString()} DEUDA
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {contact.last_contact ? (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Clock className="w-3.5 h-3.5 text-gray-600" />
                                                    {getTimeAgo(contact.last_contact)}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-600 italic uppercase font-bold">Nunca contactado</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => handleOpenMessageModal('SINGLE', contact)}
                                                className="p-2 hover:bg-primary hover:text-black rounded-lg transition-all text-primary border border-primary/20 group-hover:scale-110"
                                                title="Enviar Mensaje Personalizado"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Message Modal */}
            {isModalOpen && (
                <MessageModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    mode={modalMode}
                    clients={targetClients}
                    onSuccess={() => {
                        fetchContacts();
                        setSelectedIds([]);
                    }}
                />
            )}
        </div>
    );
};
