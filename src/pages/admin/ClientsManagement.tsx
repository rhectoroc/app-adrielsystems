import { useState, useEffect } from 'react';
import { ClientsTable } from '../../components/features/admin/ClientsTable';
import { X, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

interface Plan {
    id: number;
    name: string;
    cost: string;
    currency: string;
}

export const ClientsManagement = () => {
    const { confirm } = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [currentClientId, setCurrentClientId] = useState<number | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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
        services: [] as any[]
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
            services: client.services || []
        });
        setIsModalOpen(true);
    };

    const handleAddServiceField = () => {
        setFormData(prev => ({
            ...prev,
            services: [...prev.services, { name: '', cost: 0, special_price: '', currency: 'USD' }]
        }));
    };

    const handleRemoveServiceField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index)
        }));
    };

    const handleServiceChange = (index: number, field: string, value: any) => {
        const newServices = [...formData.services];
        newServices[index] = { ...newServices[index], [field]: value };

        // If plan name is selected, automatically fill cost/currency
        if (field === 'name') {
            const plan = plans.find(p => p.name === value);
            if (plan) {
                newServices[index].cost = plan.cost;
                newServices[index].currency = plan.currency;
            }
        }

        setFormData(prev => ({ ...prev, services: newServices }));
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
            services: []
        });
        setIsModalOpen(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = editMode && currentClientId
                ? await api.put(`/api/clients/${currentClientId}`, formData)
                : await api.post('/api/clients', formData);

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
                services: []
            });
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

    const handleDeleteClick = async (client: any) => {
        const confirmed = await confirm({
            title: 'Eliminar Cliente',
            message: `¿Estás seguro de que deseas eliminar a ${client.name}? Esta acción eliminará todos sus servicios, pagos y usuarios asociados y NO se puede deshacer.`,
            confirmText: 'Eliminar Cliente',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await api.delete(`/api/clients/${client.id}`);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Error al eliminar cliente');
            }

            toast.success('Cliente eliminado exitosamente');
            setRefreshTrigger(prev => prev + 1);
        } catch (error: any) {
            console.error('Error deleting client:', error);
            toast.error(error.message || 'Error al eliminar cliente');
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

            <ClientsTable
                onAddClick={handleAddClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                refreshTrigger={refreshTrigger}
            />

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

                            {/* Dynamic Services Section */}
                            <div className="space-y-4 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Planes / Servicios</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddServiceField}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/80 transition-all active:scale-95 shadow-lg shadow-primary/20"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar Servicio
                                    </button>
                                </div>

                                {formData.services.map((service, index) => (
                                    <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4 relative group animate-in fade-in slide-in-from-top-2">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveServiceField(index)}
                                            className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-400/10 rounded-lg"
                                            title="Eliminar Servicio"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-400">Plan Seleccionado</label>
                                                <select
                                                    value={service.name}
                                                    onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-primary focus:outline-none transition-colors"
                                                    required
                                                >
                                                    <option value="">Seleccionar un Plan</option>
                                                    {plans.map(plan => (
                                                        <option key={plan.id} value={plan.name}>
                                                            {plan.name} (${plan.cost} {plan.currency})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-400">Precio Especial (Opcional)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                                    <input
                                                        type="number"
                                                        value={service.special_price || ''}
                                                        onChange={(e) => handleServiceChange(index, 'special_price', e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-primary focus:outline-none transition-colors"
                                                        placeholder={service.cost ? `Base: ${service.cost}` : '0.00'}
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {formData.services.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                                        <Plus className="w-8 h-8 text-gray-600 mb-2 opacity-20" />
                                        <p className="text-xs text-gray-500 italic text-center">No hay servicios asociados aún.<br />Usa el botón "+" para agregar el primero.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notas Adicionales</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-primary focus:outline-none min-h-[100px]"
                                    placeholder="Información relevante sobre el cliente..."
                                />
                            </div>

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
