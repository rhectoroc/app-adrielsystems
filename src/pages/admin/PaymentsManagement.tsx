import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Save, Eye, DollarSign, Calendar, CreditCard, Edit2, TrendingUp, History, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../../utils/api';

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
}

export const PaymentsManagement = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Filter State for Clients Table
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

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

    // Form State
    const [formData, setFormData] = useState({
        client_id: '',
        service_id: '',
        amount: '',
        currency: 'USD',
        payment_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        status: 'PAGADO' as 'PAGADO' | 'PENDIENTE' | 'VENCIDO', // Default to PAID as requested
        payment_method: '',
        notes: '',
        months_covered: 1
    });

    useEffect(() => {
        fetchClients();
    }, [refreshTrigger]);

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
    const filteredClients = clients.filter(client => {
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
        setFormData({
            client_id: isFromHistory ? (selectedClient?.id.toString() || '') : '',
            service_id: isFromHistory ? (selectedClient?.service_id?.toString() || '') : '',
            amount: '',
            currency: 'USD',
            payment_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            status: 'PAGADO',
            payment_method: '',
            notes: '',
            months_covered: 1
        });

        if (isFromHistory && selectedClient) {
            const firstServiceId = selectedClient.service_id || selectedClient.services?.[0]?.id;
            if (firstServiceId) {
                handleClientChange(selectedClient.id.toString());
            }
        } else if (!fromHistory) {
            setServices([]);
        }

        if (isFromHistory) {
            setShowEditForm(true);
        } else {
            // If from main list, we'll ask to select a client or just show empty form
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
            months_covered: payment.months_covered || 1
        });

        setShowEditForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...formData,
                client_id: parseInt(formData.client_id),
                service_id: parseInt(formData.service_id),
                amount: parseFloat(formData.amount)
            };

            const response = editMode && currentPaymentId
                ? await api.put(`/api/payments/${currentPaymentId}`, payload)
                : await api.post('/api/payments', payload);

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
        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
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
        <div className="min-h-screen pb-20">
            <AnimatePresence mode="wait">
                {viewMode === 'LIST' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-white font-heading tracking-tight">Gestión de Pagos</h2>
                                <p className="text-gray-400 mt-1">Administra el historial financiero y suscripciones de tus clientes.</p>
                            </div>
                            <button
                                onClick={() => handleAddClick(false)}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-xl transition-all shadow-lg shadow-primary/20 font-bold active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                                Registrar Pago General
                            </button>
                        </div>

                        {/* Filters Card */}
                        <div className="glass-card p-2 md:p-3 overflow-hidden">
                            <div className="flex flex-col md:flex-row gap-3 items-center">
                                <div className="relative w-full md:w-96">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                        <Eye className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, empresa o email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/5 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-gray-600"
                                    />
                                </div>
                                <div className="flex gap-1.5 p-1 bg-black/40 border border-white/5 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                                    {['ALL', 'PAID', 'UPCOMING', 'OVERDUE'].map(status => {
                                        const labels: any = { ALL: 'Todos', PAID: 'Al día', UPCOMING: 'Próximos', OVERDUE: 'Vencidos' };
                                        const isActive = filterStatus === status;
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => setFilterStatus(status)}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${isActive
                                                    ? 'bg-primary text-white shadow-md'
                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                    }`}
                                            >
                                                {labels[status]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Clients Table */}
                        <div className="glass-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider">Cliente / Empresa</th>
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider">Servicios Activos</th>
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider text-right">Mensualidad Total</th>
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider text-center">Estado</th>
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredClients.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-4 bg-white/5 rounded-full">
                                                            <DollarSign className="w-8 h-8 text-gray-600" />
                                                        </div>
                                                        <p className="text-gray-500 font-medium">No se encontraron clientes con estos filtros</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredClients.map((client) => (
                                                <tr
                                                    key={client.id}
                                                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                                    onClick={() => handleViewHistory(client)}
                                                >
                                                    <td className="p-5">
                                                        <div className="font-bold text-white group-hover:text-primary transition-colors">{client.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{client.company_name || 'Particular'}</div>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="inline-flex items-center gap-2 text-sm text-gray-300 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                                <span className="truncate max-w-[150px]">{client.service_name || 'Sin suscripción'}</span>
                                                            </div>
                                                            {client.services && client.services.length > 1 && (
                                                                <div className="text-[10px] text-primary/70 font-bold ml-1">
                                                                    +{client.services.length - 1} plan(es) adicional(es)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right">
                                                        <div className="font-bold text-white text-lg">
                                                            ${(client.total_monthly || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-tighter">Total Mensual</div>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        {client.payment_status === 'OVERDUE' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                                                <AlertCircle className="w-3 h-3" /> Vencido
                                                            </span>
                                                        ) : client.payment_status === 'UPCOMING' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                <Calendar className="w-3 h-3" /> Próximo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                                                                <CheckCircle2 className="w-3 h-3" /> Al día
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-5 text-right">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleViewHistory(client); }}
                                                            className="p-2.5 bg-white/5 hover:bg-primary/20 text-gray-400 hover:text-primary rounded-xl transition-all"
                                                        >
                                                            <History className="w-5 h-5" />
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
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="space-y-8"
                    >
                        {/* Header & Navigation */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <button
                                    onClick={handleBackToList}
                                    className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all shadow-sm border border-white/5 active:scale-90"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-3xl font-bold text-white tracking-tight">{selectedClient?.name}</h2>
                                        {selectedClient?.payment_status === 'OVERDUE' && (
                                            <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest">Moroso</span>
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1">{selectedClient?.company_name} • {selectedClient?.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleAddClick(true)}
                                    className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2 group active:scale-95"
                                >
                                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                    Registrar Pago
                                </button>
                            </div>
                        </div>

                        {/* Top Stats Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="glass-card p-6 border-l-4 border-l-primary relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp className="w-24 h-24 text-white" />
                                </div>
                                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Mensualidad Total</div>
                                <div className="text-3xl font-black text-white">
                                    ${(selectedClient?.total_monthly || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-4 space-y-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                                    {selectedClient?.services?.map((service: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/5 last:border-0 hover:bg-white/5 px-1 rounded transition-colors">
                                            <span className="text-gray-400 font-medium truncate max-w-[150px]">{service.name}</span>
                                            <span className="text-primary font-black">${(service.special_price || service.cost).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`glass-card p-6 border-l-4 relative overflow-hidden group ${selectedClient?.payment_status === 'OVERDUE' ? 'border-l-red-500' : 'border-l-green-500'}`}>
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Calendar className="w-24 h-24 text-white" />
                                </div>
                                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Próximo Vencimiento</div>
                                <div className="flex items-center gap-3">
                                    <div className="text-3xl font-black text-white">
                                        {selectedClient?.expiration_date ? new Date(selectedClient.expiration_date).toLocaleDateString() : 'Pendiente'}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setNewExpirationDate(selectedClient?.expiration_date ? new Date(selectedClient.expiration_date).toISOString().split('T')[0] : '');
                                            setIsEditingExpiration(true);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-xl text-primary transition-all border border-primary/20 group hover:scale-105 active:scale-95"
                                    >
                                        <Edit2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Modificar Vencimiento</span>
                                    </button>
                                </div>
                                {isEditingExpiration && (
                                    <div className="mt-4 flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-2">
                                        <input
                                            type="date"
                                            value={newExpirationDate}
                                            onChange={(e) => setNewExpirationDate(e.target.value)}
                                            className="bg-transparent border-none text-white text-sm focus:ring-0 w-full"
                                        />
                                        <button onClick={handleUpdateExpiration} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"><Save className="w-4 h-4" /></button>
                                        <button onClick={() => setIsEditingExpiration(false)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><X className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>

                            <div className="glass-card p-6 border-l-4 border-l-indigo-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <DollarSign className="w-24 h-24 text-white" />
                                </div>
                                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Inversión Total</div>
                                <div className="text-3xl font-black text-white">
                                    $ {clientPayments.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest">{clientPayments.length} transacciones registradas</div>
                            </div>
                        </div>

                        {/* Full Width History Table */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3 font-heading tracking-tight">
                                    <History className="w-5 h-5 text-primary" />
                                    Historial de Operaciones
                                </h3>
                            </div>

                            <div className="glass-card overflow-hidden">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                        <p className="text-gray-500 font-bold animate-pulse">Sincronizando historial...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-white/5 border-b border-white/10">
                                                <tr>
                                                    <th className="p-5 font-bold text-gray-500 text-[10px] uppercase tracking-widest">Fecha de Pago (Reciente)</th>
                                                    <th className="p-5 font-bold text-gray-500 text-[10px] uppercase tracking-widest text-center">Periodo Cubierto</th>
                                                    <th className="p-5 font-bold text-gray-500 text-[10px] uppercase tracking-widest text-center">Monto</th>
                                                    <th className="p-5 font-bold text-gray-500 text-[10px] uppercase tracking-widest">Método</th>
                                                    <th className="p-5 font-bold text-gray-500 text-[10px] uppercase tracking-widest text-right">Administración</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {clientPayments.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="p-12 text-center text-gray-600 font-medium">No hay registros de pago para este cliente</td>
                                                    </tr>
                                                ) : (
                                                    clientPayments.map(payment => (
                                                        <tr key={payment.id} className="hover:bg-white/[0.03] transition-colors group">
                                                            <td className="p-5">
                                                                <div className="text-white font-bold">{new Date(payment.payment_date).toLocaleDateString()}</div>
                                                                <div className="text-[10px] text-gray-500 italic mt-1 max-w-[200px] truncate">{payment.notes || 'Sin notas'}</div>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <div className="inline-flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                                                                    <div className="text-xs text-gray-300 font-medium">
                                                                        {calculatePeriod(payment.payment_date, payment.months_covered || 1)}
                                                                    </div>
                                                                    <div className="text-[10px] font-black text-primary mt-0.5 uppercase tracking-tighter">
                                                                        {payment.months_covered} {payment.months_covered === 1 ? 'Mes Pago' : 'Meses Adelantados'}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <div className="text-xl font-black text-white">{payment.currency} {payment.amount.toLocaleString()}</div>
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                                    <div className="p-2 bg-white/5 rounded-lg">
                                                                        <CreditCard className="w-4 h-4 opacity-70" />
                                                                    </div>
                                                                    {payment.payment_method || 'Sin método'}
                                                                </div>
                                                            </td>
                                                            <td className="p-5 text-right">
                                                                <button
                                                                    onClick={() => handleEditPayment(payment)}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-primary/20 text-gray-400 hover:text-primary rounded-xl transition-all border border-white/5 group-hover:border-primary/30"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                    <span className="text-xs font-bold uppercase">Modificar Pago</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Form Modal (Re-implemented Centered) */}
                        <AnimatePresence>
                            {showEditForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowEditForm(false)}
                                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        className="glass-card w-full max-w-lg border-primary/20 relative z-50 overflow-hidden"
                                    >
                                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                                            <h3 className="font-bold text-xl text-white flex items-center gap-3">
                                                <div className="p-2 bg-primary rounded-lg text-white">
                                                    {editMode ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                </div>
                                                {editMode ? 'Modificar Registro de Pago' : 'Registrar Nuevo Pago'}
                                            </h3>
                                            <button onClick={() => setShowEditForm(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 transition-colors active:scale-95">
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                            <div className="space-y-5">
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Servicio Contratado *</label>
                                                    <select
                                                        name="service_id"
                                                        value={formData.service_id}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-5 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                                    >
                                                        <option value="">Seleccionar el servicio...</option>
                                                        {services.length > 1 && (
                                                            <option value="all" className="font-bold text-primary italic">⭐ TODOS LOS SERVICIOS (Global / Prepago)</option>
                                                        )}
                                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Monto Pagado *</label>
                                                        <div className="relative group">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black">$</span>
                                                            <input
                                                                type="number"
                                                                name="amount"
                                                                value={formData.amount}
                                                                onChange={handleInputChange}
                                                                step="0.01"
                                                                required
                                                                className="w-full pl-8 pr-5 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white font-bold focus:border-primary/50 focus:outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Meses Cubiertos *</label>
                                                        <select
                                                            name="months_covered"
                                                            value={formData.months_covered}
                                                            onChange={handleInputChange}
                                                            className="w-full px-5 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white focus:border-primary/50 focus:outline-none transition-all cursor-pointer"
                                                        >
                                                            {[1, 2, 3, 4, 6, 12].map(m => (
                                                                <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Fecha de Operación (Último Pago) *</label>
                                                    <div className="relative">
                                                        <input
                                                            type="date"
                                                            name="payment_date"
                                                            value={formData.payment_date}
                                                            onChange={handleInputChange}
                                                            required
                                                            className="w-full px-5 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white focus:border-primary/50 focus:outline-none transition-all"
                                                        />
                                                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Método de Pago</label>
                                                    <select
                                                        name="payment_method"
                                                        value={formData.payment_method}
                                                        onChange={handleInputChange}
                                                        className="w-full px-5 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white focus:border-primary/50 focus:outline-none transition-all cursor-pointer"
                                                    >
                                                        <option value="">Seleccionar método...</option>
                                                        {['PayPal', 'Zelle', 'Pago Movil', 'Bank Transfer', 'Cash', 'Other'].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Notas del Pago</label>
                                                    <textarea
                                                        name="notes"
                                                        value={formData.notes}
                                                        onChange={handleInputChange}
                                                        rows={2}
                                                        placeholder="Nro de referencia, detalles adicionales..."
                                                        className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm text-white focus:border-primary/50 focus:outline-none resize-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary/30 active:scale-[0.98] disabled:opacity-50"
                                            >
                                                {isSubmitting ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                )}
                                                {isSubmitting ? 'Guardando cambios...' : (editMode ? 'Guardar Cambios' : 'Confirmar Registro')}
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

