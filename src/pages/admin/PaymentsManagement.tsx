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
    service_status?: string;
    payment_status?: 'OVERDUE' | 'UPCOMING' | 'PAID';
    expiration_date?: string;
    service_id?: number;
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

        if (fromHistory && selectedClient?.service_id) {
            handleClientChange(selectedClient.id.toString());
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
        if (!selectedClient?.service_id || !newExpirationDate) return;

        try {
            const response = await api.put(`/api/services/${selectedClient.service_id}/expiration`, {
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
                                            <th className="p-5 font-bold text-gray-400 text-xs uppercase tracking-wider">Servicio Activo</th>
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
                                                        <div className="inline-flex items-center gap-2 text-sm text-gray-300 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                            {client.service_name || 'Sin suscripción'}
                                                        </div>
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
                                    className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Nuevo Pago
                                </button>
                            </div>
                        </div>

                        {/* Top Stats Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="glass-card p-6 border-l-4 border-l-primary relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp className="w-24 h-24 text-white" />
                                </div>
                                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Servicio Contratado</div>
                                <div className="text-2xl font-bold text-white">{selectedClient?.service_name || 'Ninguno'}</div>
                                <div className="mt-4 flex items-center gap-2 text-primary font-bold text-sm">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    Activo desde el primer pago
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
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-primary transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
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

                        {/* Main Detail Layout: History & Form */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
                            {/* History Column */}
                            <div className="lg:col-span-3 space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
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
                                                        <th className="p-4 font-bold text-gray-500 text-[10px] uppercase tracking-widest">F. Pago</th>
                                                        <th className="p-4 font-bold text-gray-500 text-[10px] uppercase tracking-widest">Periodo</th>
                                                        <th className="p-4 font-bold text-gray-500 text-[10px] uppercase tracking-widest">Monto</th>
                                                        <th className="p-4 font-bold text-gray-500 text-[10px] uppercase tracking-widest">Método</th>
                                                        <th className="p-4 font-bold text-gray-500 text-[10px] uppercase tracking-widest text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {clientPayments.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="p-12 text-center text-gray-600 font-medium">No hay registros de pago para este cliente</td>
                                                        </tr>
                                                    ) : (
                                                        clientPayments.map(payment => (
                                                            <tr key={payment.id} className={`hover:bg-white/[0.03] transition-colors ${currentPaymentId === payment.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
                                                                <td className="p-4">
                                                                    <div className="text-white font-bold">{new Date(payment.payment_date).toLocaleDateString()}</div>
                                                                    <div className="text-[10px] text-gray-500 italic mt-1 max-w-[150px] truncate">{payment.notes || 'Sin notas'}</div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-xs text-gray-300">
                                                                        {calculatePeriod(payment.payment_date, payment.months_covered || 1)}
                                                                        <span className="text-[10px] font-black text-primary ml-1">({payment.months_covered}m)</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="text-lg font-black text-white">{payment.currency} {payment.amount}</div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                                        <CreditCard className="w-4 h-4 opacity-50" />
                                                                        {payment.payment_method || 'N/A'}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={() => handleEditPayment(payment)}
                                                                        className={`p-2 rounded-xl transition-all ${currentPaymentId === payment.id ? 'bg-primary text-white' : 'hover:bg-white/10 text-gray-500 hover:text-white'}`}
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
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

                            {/* Form Column - Sticky for Desktop */}
                            <div className="lg:col-span-1 space-y-4">
                                <AnimatePresence mode="wait">
                                    {showEditForm ? (
                                        <motion.div
                                            key="form"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="glass-card border-primary/20 sticky top-24"
                                        >
                                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                                <h3 className="font-bold text-white flex items-center gap-2">
                                                    {editMode ? <Edit2 className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                                                    {editMode ? 'Editar Pago' : 'Nuevo Pago'}
                                                </h3>
                                                <button onClick={() => setShowEditForm(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Servicio *</label>
                                                        <select
                                                            name="service_id"
                                                            value={formData.service_id}
                                                            onChange={handleInputChange}
                                                            required
                                                            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Monto *</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                                                <input
                                                                    type="number"
                                                                    name="amount"
                                                                    value={formData.amount}
                                                                    onChange={handleInputChange}
                                                                    step="0.01"
                                                                    required
                                                                    className="w-full pl-7 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Meses *</label>
                                                            <select
                                                                name="months_covered"
                                                                value={formData.months_covered}
                                                                onChange={handleInputChange}
                                                                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none"
                                                            >
                                                                {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Fecha de Operación *</label>
                                                        <input
                                                            type="date"
                                                            name="payment_date"
                                                            value={formData.payment_date}
                                                            onChange={handleInputChange}
                                                            required
                                                            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Método de Pago</label>
                                                        <select
                                                            name="payment_method"
                                                            value={formData.payment_method}
                                                            onChange={handleInputChange}
                                                            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 focus:outline-none"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {['PayPal', 'Zelle', 'Pago Movil', 'Bank Transfer', 'Cash', 'Other'].map(m => (
                                                                <option key={m} value={m}>{m}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Notas</label>
                                                        <textarea
                                                            name="notes"
                                                            value={formData.notes}
                                                            onChange={handleInputChange}
                                                            rows={2}
                                                            placeholder="Referencia o detalles..."
                                                            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:border-primary/50 focus:outline-none resize-none"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting}
                                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                                                >
                                                    {isSubmitting ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <Save className="w-5 h-5" />
                                                    )}
                                                    {isSubmitting ? 'Guardando...' : 'Confirmar Registro'}
                                                </button>
                                            </form>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="placeholder"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="h-[400px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-8 gap-4"
                                        >
                                            <div className="p-5 bg-white/5 rounded-full">
                                                <DollarSign className="w-10 h-10 text-gray-700" />
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-bold">Sin acciones activas</p>
                                                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-widest font-black">Haz clic en NUEVO PAGO o EDITAR para comenzar</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

