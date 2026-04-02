import { useState, useEffect } from 'react';
import { Plus, Loader2, Save, Tag, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';

interface Plan {
    id: number;
    name: string;
    description: string;
    cost: string;
    currency: string;
    billing_cycle: string;
}

export const PlansManagement = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        cost: '',
        currency: 'USD',
        billing_cycle: 'MONTHLY'
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
            console.error('Error fetching plans:', error);
            toast.error('Error al cargar planes');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (plan: Plan) => {
        setEditMode(true);
        setCurrentPlanId(plan.id);
        setFormData({
            name: plan.name,
            description: plan.description,
            cost: plan.cost,
            currency: plan.currency,
            billing_cycle: plan.billing_cycle
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = editMode && currentPlanId
                ? await api.put(`/api/plans/${currentPlanId}`, formData)
                : await api.post('/api/plans', formData);

            if (!response.ok) throw new Error(editMode ? 'Error al actualizar plan' : 'Error al crear plan');

            toast.success(editMode ? 'Plan actualizado exitosamente' : 'Plan creado exitosamente');
            setIsModalOpen(false);
            setEditMode(false);
            setCurrentPlanId(null);
            setFormData({ name: '', description: '', cost: '', currency: 'USD', billing_cycle: 'MONTHLY' });
            fetchPlans();
        } catch (error) {
            toast.error(editMode ? 'Error al actualizar plan' : 'Error al crear plan');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white font-heading">Planes y Tarifas</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Gestión de suscripciones y modelos de facturación.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-xs font-black uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Plan
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12 opacity-50">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {plans.map((plan) => (
                        <div key={plan.id} className="glass-card p-4 flex flex-col justify-between group hover:border-primary/20 transition-all border border-white/5 relative overflow-hidden bg-white/[0.01]">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(plan)}
                                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors bg-black/40 backdrop-blur-sm"
                                    title="Editar"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 bg-primary/10 rounded text-primary">
                                        <Tag className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 uppercase tracking-widest">
                                        {plan.billing_cycle === 'MONTHLY' ? 'MENSUAL' : 'ANUAL'}
                                    </span>
                                </div>
                                <h3 className="text-sm font-black text-white mb-1 uppercase tracking-tight">{plan.name}</h3>
                                <p className="text-gray-500 text-[11px] mb-4 line-clamp-2 italic leading-relaxed">{plan.description}</p>
                            </div>

                            <div className="border-t border-white/5 pt-3 flex items-baseline gap-1">
                                <span className="text-lg font-black text-white">
                                    {plan.currency === 'USD' ? '$' : plan.currency} {plan.cost}
                                </span>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">/{plan.billing_cycle === 'MONTHLY' ? 'MES' : 'AÑO'}</span>
                            </div>
                        </div>
                    ))}

                    {plans.length === 0 && (
                        <div className="col-span-full py-10 text-center text-gray-600 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                            <p className="text-xs italic">No hay planes configurados en el sistema.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                {editMode ? 'Configurar Plan' : 'Nuevo Registro de Plan'}
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Nombre Comercial</label>
                                <input
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                    placeholder="e.g. Premium Suite"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Detalles del Servicio</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                    placeholder="Alcance y beneficios..."
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Tarifa Base</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-bold">$</span>
                                        <input
                                            name="cost"
                                            type="number"
                                            required
                                            value={formData.cost}
                                            onChange={handleInputChange}
                                            className="w-full pl-7 pr-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Divisa</label>
                                    <select
                                        name="currency"
                                        value={formData.currency}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="VES">VES</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Ciclo de Cobro</label>
                                <select
                                    name="billing_cycle"
                                    value={formData.billing_cycle}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50"
                                >
                                    <option value="MONTHLY">MENSUAL</option>
                                    <option value="YEARLY">ANUAL</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
