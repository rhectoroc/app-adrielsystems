import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Save, Eye, DollarSign, Calendar, CreditCard, AlertTriangle } from 'lucide-react';
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

    // Payment History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientPayments, setClientPayments] = useState<Payment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Edit/Create Payment Modal State
    const [editMode, setEditMode] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
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
        setIsHistoryModalOpen(true);
        fetchClientPayments(client.id);
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

    const handleAddClick = () => {
        setEditMode(false);
        setCurrentPaymentId(null);
        setFormData({
            client_id: '',
            service_id: '',
            amount: '',
            currency: 'USD',
            payment_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            status: 'PAGADO', // Default is PAID for manual entry mostly
            payment_method: '',
            notes: '',
            months_covered: 1
        });
        setServices([]);
        setIsPaymentModalOpen(true);
    };

    const handleEditPayment = async (payment: Payment) => {
        // Can edit payment from history modal
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

        setIsPaymentModalOpen(true);
        // Maybe close history modal or keep it open behind? 
        // Better UX: Close history modal to focus on edit, then reopen?
        // Let's keep history open underneath if z-index allows, or close it.
        // For simplicity, let's keep it open. Tailwind z-index handles stacking.
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
            setIsPaymentModalOpen(false);
            setEditMode(false);
            setCurrentPaymentId(null);
            setRefreshTrigger(prev => prev + 1); // Refresh clients list

            // If history modal is open (editing from history), refresh it too
            if (isHistoryModalOpen && selectedClient) {
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

    // Helper to calculate Period
    const calculatePeriod = (startDate: string, months: number) => {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Gestión de Pagos e Historial</h2>
                    <p className="text-gray-400">Administra pagos y visualiza el historial por cliente.</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Registrar Nuevo Pago
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:border-primary focus:outline-none placeholder-gray-500"
                    />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'PAGADO', 'PENDIENTE', 'VENCIDO'].map(status => {
                        // Map internal status to filter values for Clients (based on payment_status badges logic: PAID=Al dia, OVERDUE=Vencido, UPCOMING=Proximo)
                        // Actually let's use the badges logic values: 'PAID', 'OVERDUE', 'UPCOMING'
                        // Renaming for UI consistency
                        let label = status;
                        let filterVal = status;
                        if (status === 'PAGADO') { label = 'Al día'; filterVal = 'PAID'; }
                        if (status === 'PENDIENTE') { label = 'Próximo'; filterVal = 'UPCOMING'; } // 'UPCOMING' matches 'Próximo' logic 
                        if (status === 'VENCIDO') { label = 'Vencido'; filterVal = 'OVERDUE'; }
                        if (status === 'ALL') label = 'Todos';

                        return (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(filterVal)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === filterVal
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Client Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="p-4 font-medium text-gray-400">Cliente</th>
                                <th className="p-4 font-medium text-gray-400">Servicio</th>
                                <th className="p-4 font-medium text-gray-400">Estado de Servicio</th>
                                <th className="p-4 font-medium text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                        No se encontraron clientes
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{client.name}</div>
                                            <div className="text-xs text-gray-500">{client.email}</div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-300">
                                            {client.service_name || 'Sin Servicio'}
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
                                            {!client.payment_status && <span className="text-gray-500">-</span>}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleViewHistory(client)}
                                                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Ver Historial
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Modal */}
            {isHistoryModalOpen && selectedClient && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white font-heading">
                                    Historial de Pagos: {selectedClient.name}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    Servicio: {selectedClient.service_name} | Vence: {selectedClient.expiration_date ? new Date(selectedClient.expiration_date).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {loadingHistory ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 border-b border-white/10 text-xs font-medium text-gray-400 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-3">Fecha Op.</th>
                                                <th className="p-3">Monto</th>
                                                <th className="p-3">Método</th>
                                                <th className="p-3">Periodo Cubierto</th>
                                                <th className="p-3">Referencia/Notas</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {clientPayments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-6 text-center text-gray-500">
                                                        No hay pagos registrados.
                                                    </td>
                                                </tr>
                                            ) : (
                                                clientPayments.map(payment => (
                                                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-3 text-white">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-3 h-3 text-gray-500" />
                                                                {new Date(payment.payment_date).toLocaleDateString()}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-medium text-white">
                                                            {payment.currency} {payment.amount}
                                                        </td>
                                                        <td className="p-3 text-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <CreditCard className="w-3 h-3 text-gray-500" />
                                                                {payment.payment_method || '-'}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-gray-300">
                                                            {calculatePeriod(payment.payment_date, payment.months_covered || 1)}
                                                        </td>
                                                        <td className="p-3 text-gray-400 italic">
                                                            {payment.notes || '-'}
                                                        </td>
                                                        <td className="p-3">
                                                            <button
                                                                onClick={() => handleEditPayment(payment)}
                                                                className="text-gray-500 hover:text-white transition-colors"
                                                                title="Editar detalles"
                                                            >
                                                                <Eye className="w-4 h-4" />
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
                </div>
            )}

            {/* Register/Edit Payment Modal (Reused) */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white font-heading">
                                {editMode ? 'Editar Pago' : 'Registrar Pago'}
                            </h3>
                            <button
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Cliente *</label>
                                    <select
                                        name="client_id"
                                        value={formData.client_id}
                                        onChange={(e) => handleClientChange(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Seleccionar cliente</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Servicio *</label>
                                    <select
                                        name="service_id"
                                        value={formData.service_id}
                                        onChange={handleInputChange}
                                        required
                                        disabled={!formData.client_id}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none disabled:opacity-50"
                                    >
                                        <option value="">Seleccionar servicio</option>
                                        {services.map(service => (
                                            <option key={service.id} value={service.id}>{service.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Monto *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            step="0.01"
                                            required
                                            className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Meses a cubrir</label>
                                    <select
                                        name="months_covered"
                                        value={(formData as any).months_covered}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="1">1 mes</option>
                                        <option value="3">3 meses</option>
                                        <option value="6">6 meses</option>
                                        <option value="12">12 meses (1 año)</option>
                                    </select>
                                    {parseInt((formData as any).months_covered) === 12 && (
                                        <div className="flex items-start gap-2 p-3 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-200">
                                                Al seleccionar 12 meses, la fecha de expiración del servicio se extenderá un año completo.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Moneda *</label>
                                    <select
                                        name="currency"
                                        value={formData.currency}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="VES">VES</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Fecha de Pago *</label>
                                    <input
                                        type="date"
                                        name="payment_date"
                                        value={formData.payment_date}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Método de Pago</label>
                                    <select
                                        name="payment_method"
                                        value={formData.payment_method}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Seleccionar método</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Zelle">Zelle</option>
                                        <option value="Pago Movil">Pago Móvil</option>
                                        <option value="Bank Transfer">Transferencia Bancaria</option>
                                        <option value="Cash">Efectivo</option>
                                        <option value="Other">Otro</option>
                                    </select>
                                </div>
                                <div className="space-y-2 hidden"> {/* Hidden status, auto-set based on context usually */}
                                    <label className="text-sm font-medium text-gray-300">Estado</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="PAGADO">PAGADO</option>
                                        <option value="PENDIENTE">PENDIENTE</option>
                                        <option value="VENCIDO">VENCIDO</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notas / Referencia</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none resize-none"
                                    placeholder="Referencia, número de comprobante, etc..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSubmitting ? 'Guardando...' : (editMode ? 'Actualizar Pago' : 'Registrar Pago')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
