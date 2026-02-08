import { useState, useEffect } from 'react';
import { Plus, Loader2, Filter, X, Save } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);

    // ... (existing useEffect) ...

    useEffect(() => {
        fetchData();
    }, [refreshTrigger]);

    // ... (existing fetchData) ...
    // Note: ensure fetchData is called when refreshTrigger changes

    const handleEditClick = (payment: Payment) => {
        setEditMode(true);
        setCurrentPaymentId(payment.id);
        setFormData({
            client_id: payment.client_id.toString(),
            service_id: payment.service_id.toString(),
            amount: payment.amount.toString(),
            currency: payment.currency,
            payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
            due_date: new Date(payment.due_date).toISOString().split('T')[0],
            status: payment.status,
            payment_method: payment.payment_method || '',
            notes: payment.notes || ''
        });

        // Load services for this client so the dropdown is populated
        handleClientChange(payment.client_id.toString());

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

            if (!response.ok) throw new Error(editMode ? 'Failed to update payment' : 'Failed to register payment');

            toast.success(editMode ? 'Payment updated successfully' : 'Payment registered successfully');
            setIsModalOpen(false);
            setEditMode(false);
            setCurrentPaymentId(null);
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
        } catch (error) {
            toast.error(editMode ? 'Error updating payment' : 'Error registering payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ... (helper functions) ...

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Payments Management</h2>
                    <p className="text-gray-400">Track and manage all client payments.</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Register Payment
                </button>
            </div>

            {/* Filters */}
            {/* ... (keep filters) ... */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Filter by status:</span>
                </div>
                <div className="flex gap-2">
                    {['ALL', 'PAGADO', 'PENDIENTE', 'VENCIDO'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${filterStatus === status
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Payment Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Method</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No payments found
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-white">{payment.client_name || `Client #${payment.client_id}`}</td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{payment.service_name || `Service #${payment.service_id}`}</td>
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
                                                {payment.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{payment.payment_method || '-'}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                onClick={() => handleEditClick(payment)}
                                                className="text-primary hover:text-primary/80 transition-colors font-medium"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Register/Edit Payment Modal (keeping form similar but updating title) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white font-heading">
                                {editMode ? 'Edit Payment' : 'Register Payment'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        {/* ... (rest of the form is mostly same, just ensuring handleSubmit is used) ... */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* ... (fields) ... */}
                            {/* Client & Service (Disable editing client/service in Edit Mode for simplicity?) */}
                            {/* Logic: If editMode, maybe disable client/service select if backend doesn't support moving payments easily. 
                                  Or allow it. For now, let's allow it but be careful.
                                  Actually, usually you just edit date/amount/status. 
                                  Let's keep fields enabled. */}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Client *</label>
                                    <select
                                        name="client_id"
                                        value={formData.client_id}
                                        onChange={(e) => handleClientChange(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Select client</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Service *</label>
                                    <select
                                        name="service_id"
                                        value={formData.service_id}
                                        onChange={handleInputChange}
                                        required
                                        disabled={!formData.client_id}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none disabled:opacity-50"
                                    >
                                        <option value="">Select service</option>
                                        {services.map(service => (
                                            <option key={service.id} value={service.id}>{service.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* ... other fields ... */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Amount *</label>
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
                                    <label className="text-sm font-medium text-gray-300">Currency *</label>
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
                                    <label className="text-sm font-medium text-gray-300">Payment Date *</label>
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
                                    <label className="text-sm font-medium text-gray-300">Due Date *</label>
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
                                    <label className="text-sm font-medium text-gray-300">Status *</label>
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
                                    <label className="text-sm font-medium text-gray-300">Payment Method</label>
                                    <select
                                        name="payment_method"
                                        value={formData.payment_method}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Select method</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Zelle">Zelle</option>
                                        <option value="Pago Movil">Pago Movil</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Other">Other</option>
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
                                    Cancel
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
                                    {isSubmitting ? 'Saving...' : (editMode ? 'Update Payment' : 'Register Payment')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
