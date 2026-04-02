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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white font-heading">Gestión de Clientes</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Gestión centralizada de cuentas y servicios.</p>
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
                    <div className="relative w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 sticky top-0 backdrop-blur-xl z-10">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">
                                {editMode ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Empresa</label>
                                        <input
                                            type="text"
                                            name="company_name"
                                            value={formData.company_name}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Correo Electrónico *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            required
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Teléfono</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Dominio</label>
                                        <input
                                            type="text"
                                            name="domain"
                                            value={formData.domain}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                            placeholder="example.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">País</label>
                                        <input
                                            type="text"
                                            name="country"
                                            value={formData.country}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                        />
                                    </div>
                                </div>

                                {!editMode && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Contraseña *</label>
                                        <input
                                            type="password"
                                            name="password"
                                            required={!editMode}
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                        />
                                    </div>
                                )}

                                {/* Services Section */}
                                <div className="space-y-3 pt-3 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">Planes y Servicios</h4>
                                        <button
                                            type="button"
                                            onClick={handleAddServiceField}
                                            className="inline-flex items-center gap-1 text-[9px] font-black text-black bg-primary px-2 py-1 rounded hover:bg-primary/90 transition-all uppercase tracking-widest"
                                        >
                                            <Plus className="w-3 h-3" /> Agregar
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {formData.services.map((service, index) => (
                                            <div key={index} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg space-y-3 relative group animate-in fade-in zoom-in-95 duration-200">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveServiceField(index)}
                                                    className="absolute top-1.5 right-1.5 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-400/10"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Plan</label>
                                                        <select
                                                            value={service.name}
                                                            onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded-md text-[11px] text-white focus:border-primary/40 focus:outline-none"
                                                            required
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {plans.map(plan => (
                                                                <option key={plan.id} value={plan.name}>
                                                                    {plan.name} (${plan.cost} {plan.currency})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Precio Especial</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]">$</span>
                                                            <input
                                                                type="number"
                                                                value={service.special_price || ''}
                                                                onChange={(e) => handleServiceChange(index, 'special_price', e.target.value)}
                                                                className="w-full pl-5 pr-2 py-1.5 bg-black/20 border border-white/10 rounded-md text-[11px] text-white focus:border-primary/40 focus:outline-none"
                                                                placeholder={service.cost ? `Base: ${service.cost}` : '0.00'}
                                                                step="0.01"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {formData.services.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-white/5 rounded-lg bg-white/[0.01]">
                                            <p className="text-[10px] text-gray-600 italic">No hay servicios asociados aún.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Notas</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none min-h-[60px]"
                                        placeholder="Información relevante..."
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 flex justify-end gap-2 bg-white/5">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                onClick={(e) => handleSubmit(e as any)}
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {editMode ? 'Actualizar' : 'Crear Cliente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
