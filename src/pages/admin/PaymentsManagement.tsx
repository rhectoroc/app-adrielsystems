import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Save, Eye, DollarSign, Edit2, History, ArrowLeft, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../../utils/api';
import { formatSafeDate, parseSafeDate } from '../../utils/dateUtils';

interface Payment {
    id: number;
    client_id: number;
    client_name?: string;
    service_id: number;
    service_name?: string;
    amount: number;
    currency: string;
    payment_date: string;
    due_date: string;
    status: 'PAGADO' | 'PENDIENTE' | 'VENCIDO';
    payment_method: string;
    notes: string;
    months_covered: number;
    service_month: string;
    evidence_path?: string;
}

interface Client {
    id: number;
    name: string;
    company_name: string;
    email: string;
    phone: string;
    service_name?: string;
    payment_status?: 'OVERDUE' | 'UPCOMING' | 'PAID';
    expiration_date?: string;
    total_monthly?: number;
    service_id?: number; // Back for convenience
    services?: Array<{
        id: number;
        name: string;
        cost: number;
        special_price?: number;
        currency: string;
        status: string;
        expiration_date: string;
        payment_status: 'OVERDUE' | 'UPCOMING' | 'PAID';
    }>;
}

interface Service {
    id: number;
    name: string;
    client_id: number;
    special_price?: number;
    cost: number;
    expiration_date?: string;
    billing_day_fixed?: number;
}

export const PaymentsManagement = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Filter State for Clients Table
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // Stats State
    const [overdueTotal, setOverdueTotal] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(0);
    const [pendingPayments, setPendingPayments] = useState(0);

    // View State (Non-modal approach)
    const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');

    // Selection State
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientPayments, setClientPayments] = useState<Payment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Manual Expiration Edit State (Now in Detail View Side Panel)
    const [isEditingExpiration, setIsEditingExpiration] = useState(false);
    const [newExpirationDate, setNewExpirationDate] = useState('');

    // Detail View UI State
    const [showEditForm, setShowEditForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Form State
    interface PaymentFormData {
        client_id: string;
        service_id: string;
        amount: string;
        currency: string;
        payment_date: string;
        due_date: string;
        status: 'PAGADO' | 'PENDIENTE' | 'VENCIDO';
        payment_method: string;
        notes: string;
        months_covered: number | string;
        service_month: string;
    }

    const [formData, setFormData] = useState<PaymentFormData>({
        client_id: '',
        service_id: '',
        amount: '',
        currency: 'USD',
        payment_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        status: 'PAGADO',
        payment_method: '',
        notes: '',
        months_covered: 1,
        service_month: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchClients();
        fetchDashboardStats();
    }, [refreshTrigger]);

    const fetchDashboardStats = async () => {
        try {
            const response = await api.get('/api/stats');
            if (response.ok) {
                const stats = await response.json();
                setOverdueTotal(stats.overdueAmount || 0);
                setMonthlyIncome(stats.monthlyIncome || 0);
                setPendingPayments(stats.pendingAmount || 0);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats');
        }
    };

    const fetchClients = async () => {
        try {
            const response = await api.get('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(data);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            toast.error('Error cargando clientes');
        }
    };

    const fetchClientPayments = async (clientId: number) => {
        setLoadingHistory(true);
        try {
            // Using existing endpoint, verified to return necessary fields
            const response = await api.get(`/api/payments/client/${clientId}`);
            if (response.ok) {
                const data = await response.json();
                setClientPayments(data);
            }
        } catch (error) {
            console.error('Error fetching payments:', error);
            toast.error('Error cargando historial de pagos');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleViewHistory = (client: Client) => {
        setSelectedClient(client);
        setViewMode('DETAIL');
        setShowEditForm(false);
        fetchClientPayments(client.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToList = () => {
        setViewMode('LIST');
        setSelectedClient(null);
        setClientPayments([]);
    };

    // Filter Logic
    const filteredClients = clients.filter((client: Client) => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email?.toLowerCase().includes(searchTerm.toLowerCase());
 
        const matchesStatus = filterStatus === 'ALL' || client.payment_status === filterStatus;
 
        return matchesSearch && matchesStatus;
    });

    // --- Payment Form Handlers ---

    const handleClientChange = async (clientId: string) => {
        setFormData(prev => ({ ...prev, client_id: clientId, service_id: '' }));

        if (clientId) {
            try {
                const response = await api.get(`/api/clients/${clientId}/services`);
                if (response.ok) {
                    const servicesData = await response.json();
                    setServices(servicesData);
                }
            } catch (error) {
                console.error('Error fetching services:', error);
            }
        } else {
            setServices([]);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Auto-fill amount if service changes
        if (name === 'service_id') {
            const selectedService = services.find(s => s.id.toString() === value);
            if (selectedService) {
                setFormData(prev => ({
                    ...prev,
                    amount: (selectedService.special_price || selectedService.cost || '').toString(),
                    service_id: value
                }));
            }
        }
    };

    const handleAddClick = (fromHistory: any = false) => {
        const isFromHistory = fromHistory === true;
        setEditMode(false);
        setCurrentPaymentId(null);

        // Auto-fill logic
        const lastPayment = clientPayments.length > 0 ? clientPayments[0] : null;
        const lastDate = lastPayment ? new Date(lastPayment.payment_date).toISOString().split('T')[0] : '';
        const firstService = (isFromHistory && selectedClient?.services && selectedClient.services.length > 0)
            ? selectedClient.services[0]
            : null;

        setFormData({
            client_id: isFromHistory ? (selectedClient?.id.toString() || '') : '',
            service_id: isFromHistory ? (firstService?.id.toString() || '') : '',
            amount: isFromHistory ? (firstService?.special_price || firstService?.cost || '').toString() : '',
            currency: isFromHistory ? (firstService?.currency || 'USD') : 'USD',
            payment_date: isFromHistory ? lastDate : new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            status: 'PAGADO',
            payment_method: '',
            notes: '',
            months_covered: 1,
            service_month: (() => {
                if (lastPayment && lastPayment.service_month) {
                    const next = new Date(lastPayment.service_month);
                    next.setMonth(next.getMonth() + (lastPayment.months_covered || 1));
                    return next.toISOString().split('T')[0];
                }
                return new Date().toISOString().split('T')[0];
            })()
        });
        setSelectedFile(null);

        if (isFromHistory && selectedClient) {
            handleClientChange(selectedClient.id.toString());
        } else if (!fromHistory) {
            setServices([]);
        }

        if (isFromHistory) {
            setShowEditForm(true);
        } else {
            setViewMode('DETAIL');
            setShowEditForm(true);
        }
    };



    const handleEditPayment = async (payment: Payment) => {
        setEditMode(true);
        setCurrentPaymentId(payment.id);

        const clientId = payment.client_id ? payment.client_id.toString() : '';
        const serviceId = payment.service_id ? payment.service_id.toString() : '';

        if (clientId) {
            try {
                const response = await api.get(`/api/clients/${clientId}/services`);
                if (response.ok) {
                    const servicesData = await response.json();
                    setServices(servicesData);
                }
            } catch (error) { console.error(error); }
        }

        setFormData({
            client_id: clientId,
            service_id: serviceId,
            amount: payment.amount.toString(),
            currency: payment.currency || 'USD',
            payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
            due_date: new Date(payment.due_date).toISOString().split('T')[0],
            status: translateStatus(payment.status) as 'PAGADO' | 'PENDIENTE' | 'VENCIDO',
            payment_method: payment.payment_method || '',
            notes: payment.notes || '',
            months_covered: payment.months_covered || 1,
            service_month: payment.service_month || new Date().toISOString().split('T')[0]
        });

        setShowEditForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload: any = {
                ...formData,
                client_id: parseInt(formData.client_id),
                service_id: formData.service_id === 'all' ? 'all' : parseInt(formData.service_id),
                amount: parseFloat(formData.amount)
            };

            const data = new FormData();
            Object.keys(payload).forEach(key => {
                if (payload[key] !== null && payload[key] !== undefined) {
                    data.append(key, payload[key].toString());
                }
            });
            
            if (selectedFile) {
                data.append('evidence', selectedFile);
            }

            const response = editMode 
                ? await api.put(`/api/payments/${currentPaymentId}`, data)
                : await api.post('/api/payments', data);

            if (!response.ok) throw new Error(editMode ? 'Error al actualizar el pago' : 'Error al registrar el pago');

            toast.success(editMode ? 'Pago actualizado exitosamente' : 'Pago registrado exitosamente');

            // Integrated View: Close form and refresh list
            setShowEditForm(false);

            setEditMode(false);
            setCurrentPaymentId(null);
            setRefreshTrigger(prev => prev + 1);

            if (selectedClient) {
                fetchClientPayments(selectedClient.id);
            }

        } catch (error) {
            toast.error(editMode ? 'Error al actualizar el pago' : 'Error al registrar el pago');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePayment = async (paymentId: number) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de pago? Esta acción no se puede deshacer.')) return;

        try {
            const response = await api.delete(`/api/payments/${paymentId}`);
            if (response.ok) {
                toast.success('Pago eliminado exitosamente');
                if (selectedClient) {
                    fetchClientPayments(selectedClient.id);
                    setRefreshTrigger(prev => prev + 1);
                }
            } else {
                throw new Error('Error al eliminar');
            }
        } catch (error) {
            toast.error('Error al eliminar el pago');
        }
    };

    const translateStatus = (status: string) => {
        const statusMap: { [key: string]: string } = {
            'PAID': 'PAGADO',
            'PENDING': 'PENDIENTE',
            'OVERDUE': 'VENCIDO',
            'PAGADO': 'PAGADO',
            'PENDIENTE': 'PENDIENTE',
            'VENCIDO': 'VENCIDO'
        };
        return statusMap[status] || status;
    };

    const calculatePeriod = (startDate: string, months: number) => {
        const start = parseSafeDate(startDate);
        if (!start) return 'N/A';
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);

        const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

        return `${fmt(start)} - ${fmt(end)}`;
    };

    const handleUpdateExpiration = async () => {
        const serviceId = selectedClient?.service_id || selectedClient?.services?.[0]?.id;
        if (!serviceId || !newExpirationDate) return;

        try {
            const response = await api.put(`/api/services/${serviceId}/expiration`, {
                expiration_date: newExpirationDate
            });

            if (response.ok) {
                toast.success('Fecha de vencimiento actualizada');
                setIsEditingExpiration(false);
                setSelectedClient(prev => prev ? { ...prev, expiration_date: newExpirationDate } : null);
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error('Error al actualizar fecha');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar fecha');
        }
    };

    return (
        <div className="min-h-screen pb-10">
            <AnimatePresence mode="wait">
                {viewMode === 'LIST' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-heading font-bold text-white tracking-wide">Gestión de Pagos</h1>
                                <p className="text-gray-400 text-xs mt-0.5">Historial financiero y suscripciones.</p>
                            </div>
                            <button
                                onClick={() => handleAddClick(false)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg font-bold text-xs hover:bg-primary/90 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Registrar Pago General
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="glass-card p-4 border-l-2 border-red-500/50">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Por Cobrar (Mora)</div>
                                <div className="text-xl font-black text-white font-heading">${overdueTotal.toLocaleString()}</div>
                            </div>
                            <div className="glass-card p-4 border-l-2 border-primary/50">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Ingresos (Mes)</div>
                                <div className="text-xl font-black text-primary font-heading">${monthlyIncome.toLocaleString()}</div>
                            </div>
                            <div className="glass-card p-4 border-l-2 border-yellow-500/50">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Pendiente (Próximos)</div>
                                <div className="text-xl font-black text-white font-heading">${pendingPayments.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="glass-card p-2 flex flex-col md:flex-row gap-2 items-center">
                            <div className="relative flex-1">
                                <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, empresa..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white focus:outline-none"
                                />
                            </div>
                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                {['ALL', 'PAID', 'UPCOMING', 'OVERDUE'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filterStatus === status ? 'bg-primary text-black' : 'text-gray-500 hover:bg-white/5'}`}
                                    >
                                        {status === 'ALL' ? 'Todos' : status === 'PAID' ? 'Al día' : status === 'UPCOMING' ? 'Próximos' : 'Vencidos'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clients Table */}
                        <div className="glass-card overflow-hidden p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 border-b border-white/10 uppercase text-[10px] font-black text-gray-500 tracking-widest">
                                        <tr>
                                            <th className="p-3">Cliente / Empresa</th>
                                            <th className="p-3">Servicios</th>
                                            <th className="p-3 text-right">Mensualidad</th>
                                            <th className="p-3 text-center">Estado</th>
                                            <th className="p-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredClients.length === 0 ? (
                                            <tr><td colSpan={5} className="p-10 text-center text-gray-500 text-xs italic">No se encontraron clientes</td></tr>
                                        ) : (
                                            filteredClients.map((client) => (
                                                <tr key={client.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => handleViewHistory(client)}>
                                                    <td className="p-3">
                                                        <div className="font-bold text-white group-hover:text-primary transition-colors text-sm">{client.name}</div>
                                                        <div className="text-[10px] text-gray-500">{client.company_name}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="inline-flex items-center gap-2 text-[11px] text-gray-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                            <span className="truncate max-w-[120px]">{client.service_name || 'Sin plan'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-black text-white text-base">${(client.total_monthly || 0).toLocaleString()}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${client.payment_status === 'OVERDUE' ? 'bg-red-500/20 text-red-500' : client.payment_status === 'UPCOMING' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                                                            {client.payment_status === 'OVERDUE' ? 'Vencido' : client.payment_status === 'UPCOMING' ? 'Próximo' : 'Al día'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={(e) => { e.stopPropagation(); handleViewHistory(client); }} className="p-1.5 bg-white/5 hover:bg-primary/20 text-gray-400 hover:text-primary rounded-lg transition-all">
                                                            <History className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button onClick={handleBackToList} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all active:scale-90 shadow-sm border border-white/5">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-white tracking-tight">{selectedClient?.name}</h2>
                                        {selectedClient?.payment_status === 'OVERDUE' && (
                                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-black uppercase">Moroso</span>
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-[11px]">{selectedClient?.company_name} • {selectedClient?.email}</p>
                                </div>
                            </div>
                            <button onClick={() => handleAddClick(true)} className="px-4 py-2 bg-primary text-black rounded-lg font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 group shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4" /> Registrar Pago
                            </button>
                        </div>

                        {/* Top Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="glass-card p-4 border-l-2 border-l-primary relative overflow-hidden group">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Mensualidad Total</div>
                                <div className="text-xl font-black text-white">${(selectedClient?.total_monthly || 0).toLocaleString()}</div>
                                <div className="mt-2 space-y-1 max-h-[60px] overflow-y-auto pr-1 custom-scrollbar">
                                    {selectedClient?.services?.map((service: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
                                            <span className="text-gray-400 truncate max-w-[140px]">{service.name}</span>
                                            <span className="text-primary font-black">${(service.special_price || service.cost).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`glass-card p-4 border-l-2 relative overflow-hidden group ${selectedClient?.payment_status === 'OVERDUE' ? 'border-l-red-500' : 'border-l-green-500'}`}>
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Vencimiento</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-xl font-black text-white">{formatSafeDate(selectedClient?.expiration_date)}</div>
                                    <button onClick={() => { setNewExpirationDate(selectedClient?.expiration_date ? new Date(selectedClient.expiration_date).toISOString().split('T')[0] : ''); setIsEditingExpiration(true); }} className="p-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20"><Edit2 className="w-3.5 h-3.5" /></button>
                                </div>
                                {isEditingExpiration && (
                                    <div className="mt-2 flex items-center gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                                        <input type="date" value={newExpirationDate} onChange={(e) => setNewExpirationDate(e.target.value)} className="bg-transparent border-none text-white text-xs focus:ring-0 w-full" />
                                        <button onClick={handleUpdateExpiration} className="p-1 text-green-400 hover:bg-green-400/10 rounded-md"><Save className="w-3 h-3" /></button>
                                        <button onClick={() => setIsEditingExpiration(false)} className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"><X className="w-3 h-3" /></button>
                                    </div>
                                )}
                            </div>

                            <div className="glass-card p-4 border-l-2 border-l-indigo-500 relative group">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Inversión Total</div>
                                <div className="text-xl font-black text-white">$ {clientPayments.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</div>
                                <div className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-widest">{clientPayments.length} transacciones</div>
                            </div>
                        </div>

                        {/* History Table */}
                        <div className="glass-card overflow-hidden p-0 h-[calc(100vh-320px)] flex flex-col">
                            <div className="p-3 border-b border-white/5 bg-white/[0.01]">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic">
                                    <History className="w-3 h-3 text-primary" /> Historial de Operaciones
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="text-[10px] font-bold">Cargando...</span></div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white/5 sticky top-0 z-10 border-b border-white/10 uppercase text-[9px] font-black text-gray-500 tracking-widest">
                                            <tr>
                                                <th className="p-3">Fecha</th>
                                                <th className="p-3 text-center">Periodo</th>
                                                <th className="p-3 text-center">Monto</th>
                                                <th className="p-3">Método</th>
                                                <th className="p-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-xs">
                                            {clientPayments.length === 0 ? (
                                                <tr><td colSpan={5} className="p-10 text-center text-gray-500 italic">Sin registros</td></tr>
                                            ) : (
                                                clientPayments.map(payment => (
                                                    <tr key={payment.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white uppercase">{formatSafeDate(payment.payment_date)}</span>
                                                                {payment.evidence_path && (
                                                                    <a href={`/uploads/capref/${payment.evidence_path}`} target="_blank" rel="noopener noreferrer" className="p-1 bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Eye className="w-3 h-3" /></a>
                                                                )}
                                                            </div>
                                                            <div className="text-[9px] text-gray-500 truncate max-w-[120px]">{payment.notes || 'Sin notas'}</div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded border border-white/5 font-medium whitespace-nowrap">{calculatePeriod(payment.service_month, payment.months_covered || 1)}</span>
                                                        </td>
                                                        <td className="p-3 text-center font-black text-white">{payment.currency} {payment.amount.toLocaleString()}</td>
                                                        <td className="p-3 text-gray-400 uppercase text-[10px]">{payment.payment_method || 'N/A'}</td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <button onClick={() => handleEditPayment(payment)} className="p-1.5 bg-white/5 hover:bg-primary/10 text-gray-400 hover:text-primary rounded-lg transition-all border border-white/5"><Edit2 className="w-3 h-3" /></button>
                                                                <button onClick={() => handleDeletePayment(payment.id)} className="p-1.5 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-all border border-white/5"><Trash2 className="w-3 h-3" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Modal Form */}
                        <AnimatePresence>
                            {showEditForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditForm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card w-full max-w-md relative z-50 overflow-hidden border border-white/10 shadow-2xl">
                                        <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/[0.03]">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-primary" />
                                                <h2 className="text-xs font-black text-white uppercase tracking-wider">{editMode ? 'Editar Pago' : 'Registrar Pago'}</h2>
                                            </div>
                                            <button onClick={() => setShowEditForm(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                                        </div>
                                        <form onSubmit={handleSubmit} className="p-4 space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Servicio</label>
                                                <select name="service_id" value={formData.service_id} onChange={handleInputChange} required className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary/50">
                                                    <option value="">Seleccione...</option>
                                                    {services.length > 1 && <option value="all">TODOS LOS SERVICIOS</option>}
                                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Monto</label>
                                                    <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Meses a Cubrir</label>
                                                    <select name="months_covered" value={formData.months_covered} onChange={handleInputChange} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none">
                                                        {[1, 2, 3, 4, 5, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 italic flex justify-between">
                                                    <span>Mes de Inicio de Servicio</span>
                                                    {Number(formData.months_covered) > 1 && <span className="text-primary font-black uppercase">Periodo Extendido</span>}
                                                </label>
                                                <div className="relative group">
                                                    <input 
                                                        type="month" 
                                                        name="service_month" 
                                                        value={formData.service_month.slice(0, 7)} 
                                                        onChange={(e) => setFormData(prev => ({ ...prev, service_month: e.target.value + '-01' }))} 
                                                        required 
                                                        className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary/50 transition-all" 
                                                    />
                                                    <div className="mt-1 flex justify-between items-center px-1">
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Atribuido a:</span>
                                                        <span className="text-[10px] text-white font-black uppercase tracking-tighter">
                                                            {calculatePeriod(formData.service_month, parseInt(formData.months_covered.toString()))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Fecha</label>
                                                    <input type="date" name="payment_date" value={formData.payment_date} onChange={handleInputChange} required className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary/50" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Método</label>
                                                    <select name="payment_method" value={formData.payment_method} onChange={handleInputChange} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white">
                                                        <option value="">Seleccionar...</option>
                                                        {['PayPal', 'Zelle', 'Pago Movil', 'Bank Transfer', 'Cash'].map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1 italic">Comprobante (Opcional)</label>
                                                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-[10px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer" />
                                            </div>
                                            <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-black rounded-lg font-black text-xs uppercase tracking-widest transition-all mt-4 disabled:opacity-50">
                                                {isSubmitting ? 'Procesando...' : (editMode ? 'Actualizar' : 'Registrar Pago')}
                                            </button>
                                        </form>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

