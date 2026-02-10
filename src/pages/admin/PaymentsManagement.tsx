import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Save } from 'lucide-react';
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
}

interface Client {
    id: number;
    name: string;
}

interface Service {
    id: number;
    name: string;
    client_id: number;
}

export const PaymentsManagement = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const [formData, setFormData] = useState({
        client_id: '',
        service_id: '',
        amount: '',
        currency: 'USD',
        payment_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        status: 'PENDIENTE' as 'PAGADO' | 'PENDIENTE' | 'VENCIDO',
        payment_method: '',
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, [refreshTrigger]);

    const fetchData = async () => {
        try {
            const [paymentsRes, clientsRes] = await Promise.all([
                api.get('/api/payments'),
                api.get('/api/clients')
            ]);

            if (paymentsRes.ok && clientsRes.ok) {
                const paymentsData = await paymentsRes.json();
                const clientsData = await clientsRes.json();

                setPayments(paymentsData);
                setClients(clientsData);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error cargando datos');
        }
    };

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
    };

    const handleEditClick = async (payment: Payment) => {
        setEditMode(true);
        setCurrentPaymentId(payment.id);

        // Safely handle null/undefined values
        const clientId = payment.client_id ? payment.client_id.toString() : '';
        const serviceId = payment.service_id ? payment.service_id.toString() : '';

        // Load services for this client independently to avoid resetting form data
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

        setFormData({
            client_id: clientId,
            service_id: serviceId,
            amount: payment.amount.toString(),
            currency: payment.currency || 'USD',
            payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
            due_date: new Date(payment.due_date).toISOString().split('T')[0],
            status: translateStatus(payment.status) as 'PAGADO' | 'PENDIENTE' | 'VENCIDO',
            payment_method: payment.payment_method || '',
            notes: payment.notes || ''
        });

        setIsModalOpen(true);
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
            status: 'PENDIENTE',
            payment_method: '',
            notes: ''
        });
        setServices([]);
        setIsModalOpen(true);
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
            setIsModalOpen(false);
            setEditMode(false);
            setCurrentPaymentId(null);
            setRefreshTrigger(prev => prev + 1);
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

    const getStatusColor = (status: string) => {
        const normalizedStatus = translateStatus(status);
        switch (normalizedStatus) {
            case 'PAGADO': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'PENDIENTE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'VENCIDO': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const [filterClient, setFilterClient] = useState<string>('');
    const [filterMonth, setFilterMonth] = useState<string>('');

    const filteredPayments = payments.filter(p => {
        const statusMatch = filterStatus === 'ALL' || p.status === filterStatus;
        const clientMatch = !filterClient || p.client_id.toString() === filterClient;
        const monthMatch = !filterMonth || p.payment_date.startsWith(filterMonth);
        return statusMatch && clientMatch && monthMatch;
    });

    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateMonth, setGenerateMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGeneratePayments = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            const [year, month] = generateMonth.split('-');
            const response = await api.post('/api/payments/generate', {
                year: parseInt(year),
                month: parseInt(month)
            });

            if (!response.ok) throw new Error('Error generating payments');

            const result = await response.json();
            toast.success(result.message);
            setIsGenerateModalOpen(false);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            toast.error('Error al generar pagos');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ... Existing header ... */}

            {/* ... Existing Filters ... */}

            {/* ... Existing Table ... */}

            {/* Generate Payments Modal */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white font-heading">
                                Generar Pagos Mensuales
                            </h3>
                            <button
                                onClick={() => setIsGenerateModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <p className="text-gray-400 mb-4 text-sm">
                            Esto generará registros de pago "PENDIENTE" para todos los servicios activos que no tengan un pago registrado para el mes seleccionado.
                        </p>
                        <form onSubmit={handleGeneratePayments} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Seleccionar Mes y Año</label>
                                <input
                                    type="month"
                                    value={generateMonth}
                                    onChange={(e) => setGenerateMonth(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsGenerateModalOpen(false)}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isGenerating ? 'Generando...' : 'Generar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Gestión de Pagos</h2>
                    <p className="text-gray-400">Rastrea y gestiona todos los pagos de clientes.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-black rounded-lg transition-colors text-sm font-medium"
                    >
                        <Save className="w-4 h-4" />
                        Generar Pagos Mensuales
                    </button>
                    <button
                        onClick={handleAddClick}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Registrar Pago
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                    {/* Client Filter */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Cliente</label>
                        <select
                            value={filterClient}
                            onChange={(e) => setFilterClient(e.target.value)}
                            className="w-full md:w-48 px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:border-primary focus:outline-none"
                        >
                            <option value="">Todos los Clientes</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Filter */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Mes</label>
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="w-full md:w-auto px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:border-primary focus:outline-none"
                        />
                    </div>

                    {(filterClient || filterMonth || filterStatus !== 'ALL') && (
                        <button
                            onClick={() => {
                                setFilterClient('');
                                setFilterMonth('');
                                setFilterStatus('ALL');
                            }}
                            className="mt-5 text-xs text-gray-400 hover:text-white underline"
                        >
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    {['ALL', 'PAGADO', 'PENDIENTE', 'VENCIDO'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === status
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Payments Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Monto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Pago</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Venc.</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Método</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No se encontraron pagos
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-white">{payment.client_name || `Client #${payment.client_id}`}</td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{payment.service_name || (payment.service_id ? `Servicio #${payment.service_id}` : 'General / Sin Servicio')}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-white">
                                            {payment.currency} {payment.amount}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">
                                            {new Date(payment.payment_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">
                                            {new Date(payment.due_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(payment.status)}`}>
                                                {translateStatus(payment.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{payment.payment_method || '-'}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                onClick={() => handleEditClick(payment)}
                                                className="text-primary hover:text-primary/80 transition-colors font-medium"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Register/Edit Payment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white font-heading">
                                {editMode ? 'Editar Pago' : 'Registrar Pago'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                    <input
                                        type="number"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
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
                                    <label className="text-sm font-medium text-gray-300">Fecha de Vencimiento *</label>
                                    <input
                                        type="date"
                                        name="due_date"
                                        value={formData.due_date}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Estado *</label>
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
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none resize-none"
                                    placeholder="Additional notes..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
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
