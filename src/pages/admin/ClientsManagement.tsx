import { useState, useEffect } from 'react';
import { ClientsTable } from '../../components/features/admin/ClientsTable';
import { X, Loader2, Save, Calendar, DollarSign, History, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';

interface Plan {
    id: number;
    name: string;
    cost: string;
    currency: string;
}

interface Payment {
    id: number;
    amount: number;
    currency: string;
    payment_date: string;
    payment_method: string;
    notes: string;
    months_covered: number;
}

export const ClientsManagement = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [currentClientId, setCurrentClientId] = useState<number | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Payment History State
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        domain: '',
        country: '',
        notes: '',
        contact_info: '',
        password: '',
        service_name: '', // Selected Plan ID or Name
        special_price: '',
        expiration_date: '' // To display next payment
    });

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const response = await api.get('/api/plans');
            if (response.ok) {
                const data = await response.json();
                setPlans(data);
            }
        } catch (error) {
            console.error('Error fetching plans');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditClick = (client: any) => {
        setEditMode(true);
        setCurrentClientId(client.id);
        setFormData({
            name: client.name || '',
            company_name: client.company_name || '',
            email: client.email || '',
            phone: client.phone || '',
            domain: client.domain || '',
            country: client.country || '',
            notes: client.notes || '',
            contact_info: client.contact_info || '',
            password: '',
            service_name: client.service_name || '',
            special_price: client.special_price || '',
            expiration_date: client.expiration_date || ''
        });
        fetchHistory(client.id);
        setIsModalOpen(true);
    };

    const fetchHistory = async (clientId: number) => {
        setLoadingHistory(true);
        try {
            const response = await api.get(`/api/payments/client/${clientId}`);
            if (response.ok) {
                const data = await response.json();
                setPaymentHistory(data);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAddClick = () => {
        setEditMode(false);
        setCurrentClientId(null);
        setPaymentHistory([]);
        setFormData({
            name: '',
            company_name: '',
            email: '',
            phone: '',
            domain: '',
            country: '',
            notes: '',
            contact_info: '',
            password: '',
            service_name: '',
            special_price: '',
            expiration_date: ''
        });
        setIsModalOpen(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // If taking a plan, we need to find its details to send
            let payload: any = { ...formData };
            if (formData.service_name) {
                const selectedPlan = plans.find(p => p.name === formData.service_name);
                if (selectedPlan) {
                    payload.cost = selectedPlan.cost;
                    payload.currency = selectedPlan.currency;
                }
            }

            const response = editMode && currentClientId
                ? await api.put(`/api/clients/${currentClientId}`, payload)
                : await api.post('/api/clients', payload);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to save client');
            }

            toast.success(editMode ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente');
            setIsModalOpen(false);
            setFormData({
                name: '',
                company_name: '',
                email: '',
                phone: '',
                domain: '',
                country: '',
                notes: '',
                contact_info: '',
                password: '',
                service_name: '',
                special_price: '',
                expiration_date: ''
            });
            setPaymentHistory([]);
            setEditMode(false);
            setCurrentClientId(null);
            setRefreshTrigger(prev => prev + 1); // Trigger table refresh

        } catch (error: any) {
            console.error('Error saving client:', error);
            toast.error(error.message || 'Error saving client');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Gestión de Clientes</h2>
                    <p className="text-gray-400">Ver y gestionar cuentas de clientes.</p>
                </div>
            </div>

            <ClientsTable onAddClick={handleAddClick} onEditClick={handleEditClick} refreshTrigger={refreshTrigger} />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 sticky top-0 backdrop-blur-xl z-10">
                            <h3 className="text-xl font-bold text-white font-heading">
                                {editMode ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Nombre Completo</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Nombre de Empresa</label>
                                    <input
                                        type="text"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Teléfono</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Dominio</label>
                                    <input
                                        type="text"
                                        name="domain"
                                        value={formData.domain}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                        placeholder="example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">País</label>
                                    <input
                                        type="text"
                                        name="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                            </div>

                            {!editMode && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Contraseña</label>
                                    <input
                                        type="password"
                                        name="password"
                                        required={!editMode}
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Plan / Servicio</label>
                                <select
                                    name="service_name"
                                    value={formData.service_name}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                >
                                    <option value="">Seleccionar un Plan</option>
                                    {plans.map(plan => (
                                        <option key={plan.id} value={plan.name}>
                                            {plan.name} ({plan.cost} {plan.currency})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Precio Especial (Opcional)</label>
                                <input
                                    type="number"
                                    name="special_price"
                                    value={(formData as any).special_price || ''}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    placeholder="Dejar vacío para usar precio del plan"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notas</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    rows={3}
                                />
                            </div>

                            {/* Payment History Section */}
                            {editMode && (
                                <div className="mt-8 pt-8 border-t border-white/10 space-y-6">
                                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                                        <History className="w-5 h-5 text-primary" />
                                        <h3>Resumen de Pagos</h3>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                                <TrendingUp className="w-3 h-3" />
                                                INICIO DE SERVICIO
                                            </div>
                                            <div className="text-white font-medium">
                                                {paymentHistory.length > 0
                                                    ? new Date(Math.min(...paymentHistory.map(p => new Date(p.payment_date).getTime()))).toLocaleDateString()
                                                    : 'Sin pagos'}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                                <DollarSign className="w-3 h-3" />
                                                ÚLTIMO PAGO
                                            </div>
                                            <div className="text-white font-medium">
                                                {paymentHistory.length > 0
                                                    ? `${paymentHistory[0].currency} ${paymentHistory[0].amount} (${new Date(paymentHistory[0].payment_date).toLocaleDateString()})`
                                                    : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                                            <div className="flex items-center gap-2 text-primary text-xs mb-1 font-bold">
                                                <Calendar className="w-3 h-3" />
                                                PRÓXIMO VENCIMIENTO
                                            </div>
                                            <div className="text-white font-bold text-lg">
                                                {formData.expiration_date ? new Date(formData.expiration_date).toLocaleDateString() : 'Pendiente'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Table */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-300">Historial Detallado</h4>
                                        <div className="rounded-xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-white/5 text-gray-400">
                                                    <tr>
                                                        <th className="p-2">Fecha</th>
                                                        <th className="p-2">Monto</th>
                                                        <th className="p-2">Método</th>
                                                        <th className="p-2">Periodo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {loadingHistory ? (
                                                        <tr><td colSpan={4} className="p-4 text-center text-gray-500">Cargando...</td></tr>
                                                    ) : paymentHistory.length === 0 ? (
                                                        <tr><td colSpan={4} className="p-4 text-center text-gray-500">No hay pagos registrados</td></tr>
                                                    ) : (
                                                        paymentHistory.map(p => (
                                                            <tr key={p.id}>
                                                                <td className="p-2 text-white">{new Date(p.payment_date).toLocaleDateString()}</td>
                                                                <td className="p-2 text-white font-medium">{p.currency} {p.amount}</td>
                                                                <td className="p-2 text-gray-400">{p.payment_method || '-'}</td>
                                                                <td className="p-2 text-gray-400">{p.months_covered} mes(es)</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4 mt-4 border-t border-white/10 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editMode ? 'Actualizar Cliente' : 'Crear Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
