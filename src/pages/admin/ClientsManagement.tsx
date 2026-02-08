import { useState, useEffect } from 'react';
import { ClientsTable } from '../../components/features/admin/ClientsTable';
import { X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';

interface Plan {
    id: number;
    name: string;
    cost: string;
    currency: string;
}

export const ClientsManagement = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [currentClientId, setCurrentClientId] = useState<number | null>(null);

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
            password: '', // Keep empty
            service_name: client.service_name || ''
        });
        setIsModalOpen(true);
    };

    const handleAddClick = () => {
        setEditMode(false);
        setCurrentClientId(null);
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
            service_name: ''
        });
        setIsModalOpen(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // If taking a plan, we need to find its details to send (for creation)
            let payload: any = { ...formData };
            if (!editMode && formData.service_name) {
                const selectedPlan = plans.find(p => p.name === formData.service_name);
                if (selectedPlan) {
                    payload.cost = selectedPlan.cost;
                    payload.currency = selectedPlan.currency;
                }
            }

            const response = editMode && currentClientId
                ? await api.put(`/api/clients/${currentClientId}`, payload)
                : await api.post('/api/clients', payload);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save client');
            }

            toast.success(editMode ? 'Client updated successfully' : 'Client created successfully');
            setIsModalOpen(false);
            window.location.reload(); // Simple refresh to show changes

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white font-heading">Clients Management</h2>
                    <p className="text-gray-400">View and manage client accounts.</p>
                </div>
            </div>

            <ClientsTable onAddClick={handleAddClick} onEditClick={handleEditClick} />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 sticky top-0 backdrop-blur-xl z-10">
                            <h3 className="text-xl font-bold text-white font-heading">
                                {editMode ? 'Edit Client' : 'Add New Client'}
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
                                    <label className="text-sm font-medium text-gray-300">Full Name</label>
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
                                    <label className="text-sm font-medium text-gray-300">Company Name</label>
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
                                    <label className="text-sm font-medium text-gray-300">Email</label>
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
                                    <label className="text-sm font-medium text-gray-300">Phone</label>
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
                                    <label className="text-sm font-medium text-gray-300">Domain</label>
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
                                    <label className="text-sm font-medium text-gray-300">Country</label>
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
                                    <label className="text-sm font-medium text-gray-300">Password</label>
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
                                <label className="text-sm font-medium text-gray-300">Plan / Service</label>
                                <select
                                    name="service_name"
                                    value={formData.service_name}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                >
                                    <option value="">Select a Plan</option>
                                    {plans.map(plan => (
                                        <option key={plan.id} value={plan.name}>
                                            {plan.name} ({plan.cost} {plan.currency})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none"
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end pt-4 mt-4 border-t border-white/10 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editMode ? 'Update Client' : 'Create Client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
