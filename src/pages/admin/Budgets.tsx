import React, { useState, useEffect, useRef } from 'react';
import { 
    Calculator, DollarSign, FileText, Plus, 
    Trash2, Briefcase, Mail, Building2, CheckCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';

interface OperatingCost {
    id: number;
    name: string;
    amount: string;
    currency: string;
    category: string;
}

interface BudgetItem {
    id: number;
    description: string;
    hours: number;
    is_direct_cost: boolean;
    cost_amount: number;
}

export const Budgets = () => {
    const [activeTab, setActiveTab] = useState<'calculator' | 'costs'>('calculator');
    const [isLoading, setIsLoading] = useState(false);

    // --- COSTS STATE ---
    const [operatingCosts, setOperatingCosts] = useState<OperatingCost[]>([]);
    const [newCost, setNewCost] = useState({ name: '', amount: '', category: 'OPERATING', currency: 'USD' });
    const billableHoursPerMonth = 160; // Standard 40h/week

    // --- BUDGET STATE ---
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [projectName, setProjectName] = useState('');
    const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
    const [newItem, setNewItem] = useState({ description: '', hours: 0, is_direct_cost: false, cost_amount: 0 });
    const [profitMargin, setProfitMargin] = useState(30);

    const pdfRef = useRef<HTMLDivElement>(null);

    const fetchCosts = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/operating-costs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOperatingCosts(Array.isArray(data) ? data : []);
            } else {
                console.error("Failed to fetch operating costs:", res.status);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchCosts();
    }, []);

    // --- CALCULATIONS ---
    const totalMonthlyCost = operatingCosts.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    const baseHourlyRate = totalMonthlyCost > 0 ? (totalMonthlyCost / billableHoursPerMonth) : 15; // fallback to 15 if no costs

    const totalProjectHours = budgetItems.reduce((acc, curr) => acc + (curr.is_direct_cost ? 0 : curr.hours), 0);
    const totalDirectCosts = budgetItems.reduce((acc, curr) => acc + (curr.is_direct_cost ? curr.cost_amount : 0), 0);
    const baseProjectCost = (totalProjectHours * baseHourlyRate) + totalDirectCosts;
    const profitAmount = baseProjectCost * (profitMargin / 100);
    const finalPrice = baseProjectCost + profitAmount;

    // --- HANDLERS ---
    const handleAddCost = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/operating-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newCost)
            });
            if (res.ok) {
                toast.success('Gasto agregado exitosamente');
                setNewCost({ name: '', amount: '', category: 'OPERATING', currency: 'USD' });
                fetchCosts();
            }
        } catch (err) {
            toast.error('Error al guardar');
        }
    };

    const handleDeleteCost = async (id: number) => {
        try {
            const token = localStorage.getItem('auth_token');
            await fetch(`/api/operating-costs/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Gasto eliminado');
            fetchCosts();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        setBudgetItems([...budgetItems, { ...newItem, id: Date.now() }]);
        setNewItem({ description: '', hours: 0, is_direct_cost: false, cost_amount: 0 });
    };

    const handleDeleteItem = (id: number) => {
        setBudgetItems(budgetItems.filter(item => item.id !== id));
    };

    const generateAndSendPDF = async () => {
        if (!clientName || !projectName || budgetItems.length === 0 || !clientEmail) {
            toast.error('Faltan datos del cliente, correo o ítems del presupuesto');
            return;
        }

        setIsLoading(true);
        try {
            const element = pdfRef.current;
            if (!element) return;

            // Make element visible for html2pdf (temporarily)
            element.style.display = 'block';

            const opt = {
                margin: 0,
                filename: `Presupuesto_${projectName}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
            };

            // Generate PDF as Base64
            const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
            
            // Hide element again
            element.style.display = 'none';

            // Send to Backend
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/budgets/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email: clientEmail,
                    clientName,
                    projectName,
                    pdfBase64,
                    finalPrice: finalPrice.toFixed(2)
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success('Presupuesto enviado exitosamente por correo');
            } else {
                toast.error(data.message || 'Error al enviar');
            }

        } catch (err) {
            console.error(err);
            toast.error('Hubo un error al generar o enviar el PDF');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Briefcase className="w-6 h-6 text-primary" />
                        Presupuestos & Costos
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Cálculo de costo por hora, generación de cotizaciones y envío de PDF corporativo.
                    </p>
                </div>
                
                <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                    <button
                        onClick={() => setActiveTab('calculator')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'calculator' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Calculator className="w-4 h-4" />
                        Calculadora
                    </button>
                    <button
                        onClick={() => setActiveTab('costs')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'costs' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Estructura de Costos
                    </button>
                </div>
            </div>

            {/* TAB: CALCULADORA DE PRESUPUESTOS */}
            {activeTab === 'calculator' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    {/* Formulario */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" /> Datos del Cliente
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Nombre / Empresa</label>
                                    <input 
                                        type="text" 
                                        value={clientName} onChange={e => setClientName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 focus:border-primary outline-none" 
                                        placeholder="Ej. Acme Corp" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Correo Electrónico</label>
                                    <input 
                                        type="email" 
                                        value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 focus:border-primary outline-none" 
                                        placeholder="ejemplo@acme.com" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Nombre del Proyecto</label>
                                    <input 
                                        type="text" 
                                        value={projectName} onChange={e => setProjectName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 focus:border-primary outline-none" 
                                        placeholder="Ej. Rediseño de Aplicación Web" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-green-400" /> Detalles del Proyecto (Módulos/Costos)
                            </h2>
                            <form onSubmit={handleAddItem} className="flex flex-wrap gap-4 items-end mb-6 bg-black/30 p-4 rounded-xl border border-white/5">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs text-gray-400 mb-1">Descripción</label>
                                    <input required type="text" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="Ej. Diseño UI/UX" />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs text-gray-400 mb-1">Horas</label>
                                    <input type="number" min="0" disabled={newItem.is_direct_cost} value={newItem.hours} onChange={e => setNewItem({...newItem, hours: parseFloat(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none disabled:opacity-50" />
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs text-gray-400 mb-1">Costo Fijo ($)</label>
                                    <input type="number" min="0" disabled={!newItem.is_direct_cost} value={newItem.cost_amount} onChange={e => setNewItem({...newItem, cost_amount: parseFloat(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none disabled:opacity-50" />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <input type="checkbox" id="is_direct" checked={newItem.is_direct_cost} onChange={e => setNewItem({...newItem, is_direct_cost: e.target.checked, hours: 0})} className="w-4 h-4 accent-primary" />
                                    <label htmlFor="is_direct" className="text-xs text-gray-400">Es costo fijo (Plugin, Hosting)</label>
                                </div>
                                <button type="submit" className="bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/30 transition-colors">
                                    Agregar
                                </button>
                            </form>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-black/40 text-gray-400">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium rounded-l-lg">Descripción</th>
                                            <th className="px-4 py-3 text-center font-medium">Horas</th>
                                            <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                                            <th className="px-4 py-3 text-center font-medium rounded-r-lg">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {budgetItems.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-gray-200">
                                                    {item.description}
                                                    {item.is_direct_cost && <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">Costo Fijo</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-400">
                                                    {item.is_direct_cost ? '-' : `${item.hours}h`}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    ${item.is_direct_cost ? item.cost_amount.toFixed(2) : (item.hours * baseHourlyRate).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-300 p-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Resumen Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
                            
                            <h3 className="text-lg font-bold mb-6 text-white">Resumen de Cotización</h3>
                            
                            <div className="space-y-4 text-sm mb-6">
                                <div className="flex justify-between text-gray-400">
                                    <span>Costo Operativo (Base)</span>
                                    <span className="text-gray-200">${baseProjectCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-400">
                                    <span>Margen de Ganancia (%)</span>
                                    <input 
                                        type="number" min="0" max="100" 
                                        value={profitMargin} onChange={e => setProfitMargin(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-black/50 border border-white/10 rounded text-center px-2 py-1 text-white focus:border-primary outline-none"
                                    />
                                </div>
                                <div className="flex justify-between text-primary/80">
                                    <span>Ganancia Neta</span>
                                    <span>+${profitAmount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                    <span className="font-bold text-gray-300 text-lg">PRECIO FINAL</span>
                                    <span className="font-black text-2xl text-white">${finalPrice.toFixed(2)} <span className="text-sm font-normal text-gray-500">USD</span></span>
                                </div>
                            </div>

                            <button 
                                onClick={generateAndSendPDF}
                                disabled={isLoading}
                                className="w-full bg-primary text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-70"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <><Mail className="w-5 h-5" /> Generar y Enviar PDF</>
                                )}
                            </button>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-sm">
                            <div className="flex gap-3 mb-2">
                                <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                                <p className="text-blue-200 font-medium">Información Mágica</p>
                            </div>
                            <p className="text-blue-300/70 pl-8">
                                El sistema ha determinado que tu <strong>Costo Base por Hora</strong> actual es de <strong className="text-blue-300">${baseHourlyRate.toFixed(2)}</strong> basándose en tus gastos administrativos. 
                                Nunca cobres un proyecto por debajo de este monto para evitar pérdidas operativas.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ESTRUCTURA DE COSTOS */}
            {activeTab === 'costs' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-primary" /> Gastos Operativos Mensuales (OPEX)
                        </h2>
                        
                        <form onSubmit={handleAddCost} className="flex flex-wrap gap-4 items-end mb-6 bg-black/30 p-4 rounded-xl border border-white/5">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs text-gray-400 mb-1">Concepto (Ej. Internet, Alquiler, Nómina)</label>
                                <input required type="text" value={newCost.name} onChange={e => setNewCost({...newCost, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                            </div>
                            <div className="w-32">
                                <label className="block text-xs text-gray-400 mb-1">Monto (USD)</label>
                                <input required type="number" step="0.01" min="0" value={newCost.amount} onChange={e => setNewCost({...newCost, amount: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                            </div>
                            <button type="submit" className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-bold hover:bg-white/20 transition-colors">
                                Guardar
                            </button>
                        </form>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-black/40 text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium rounded-l-lg">Concepto</th>
                                        <th className="px-4 py-3 text-right font-medium">Monto / Mes</th>
                                        <th className="px-4 py-3 text-center font-medium rounded-r-lg">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {operatingCosts.length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-6 text-gray-500">No hay gastos fijos registrados.</td></tr>
                                    ) : (
                                        operatingCosts.map(cost => (
                                            <tr key={cost.id}>
                                                <td className="px-4 py-3 text-gray-200">{cost.name}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-300">${parseFloat(cost.amount).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleDeleteCost(cost.id)} className="text-red-400 hover:text-red-300 p-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 text-center">
                            <DollarSign className="w-12 h-12 text-primary mx-auto mb-4 opacity-80" />
                            <h3 className="text-gray-400 font-medium mb-1">Costo Base por Hora</h3>
                            <div className="text-5xl font-black text-white mb-2">
                                ${baseHourlyRate.toFixed(2)}
                            </div>
                            <p className="text-xs text-primary/60">
                                Basado en ${totalMonthlyCost.toFixed(2)} de gastos fijos / {billableHoursPerMonth}h hábiles mensuales.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* HIDDEN PDF TEMPLATE (RENDERED ONLY FOR EXPORT) */}
            <div style={{ display: 'none' }}>
                <div ref={pdfRef} style={{ width: '800px', minHeight: '1131px', backgroundColor: 'white', color: 'black', position: 'relative', fontFamily: 'Arial, sans-serif' }}>
                    {/* Header Adriel's Systems Style */}
                    <div style={{ display: 'flex', height: '100px', width: '100%', position: 'relative', backgroundColor: '#e2e8f0' }}>
                        {/* Dark Gray Block with Logo */}
                        <div style={{ backgroundColor: '#64748b', width: '30%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
                            <div style={{ color: 'white', fontWeight: '900', fontSize: '24px', letterSpacing: '2px', fontFamily: 'sans-serif' }}>
                                AS
                            </div>
                        </div>
                        {/* Light Blue Stripe */}
                        <div style={{ flex: 1, backgroundColor: '#7dd3fc', height: '15px', position: 'absolute', bottom: '0', left: '26%', right: '0', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5% 100%)' }}></div>
                    </div>

                    {/* PDF Content */}
                    <div style={{ padding: '60px 50px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                            <div>
                                <h1 style={{ fontSize: '32px', color: '#1e293b', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Presupuesto</h1>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Proyecto: <strong>{projectName || 'N/A'}</strong></p>
                                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px' }}>Fecha: {new Date().toLocaleDateString('es-VE')}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Preparado para:</p>
                                <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{clientName || 'Cliente'}</h2>
                                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px' }}>{clientEmail}</p>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569', fontSize: '13px', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1' }}>Descripción del Servicio</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'center', color: '#475569', fontSize: '13px', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1' }}>Horas</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'right', color: '#475569', fontSize: '13px', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1' }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {budgetItems.map((item, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '15px', color: '#1e293b', fontSize: '14px' }}>
                                            {item.description}
                                            {item.is_direct_cost && <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>* Costo Fijo Directo</span>}
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                                            {item.is_direct_cost ? '-' : `${item.hours}h`}
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'right', color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>
                                            ${item.is_direct_cost ? item.cost_amount.toFixed(2) : (item.hours * baseHourlyRate).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '14px' }}>
                                    <span>Subtotal Operativo:</span>
                                    <span>${baseProjectCost.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '14px' }}>
                                    <span>Honorarios Profesionales:</span>
                                    <span>${profitAmount.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>
                                    <span>TOTAL A PAGAR:</span>
                                    <span>${finalPrice.toFixed(2)} USD</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '60px', color: '#64748b', fontSize: '12px', lineHeight: '1.6' }}>
                            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Términos y Condiciones:</p>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                <li>Este presupuesto tiene una validez de 15 días continuos a partir de su fecha de emisión.</li>
                                <li>El pago deberá realizarse en un 50% como adelanto para iniciar el proyecto, y el 50% restante contra entrega final.</li>
                                <li>Los costos fijos (dominios, hosting, plugins) deben ser cancelados en su totalidad al inicio.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Footer Adriel's Systems Style */}
                    <div style={{ display: 'flex', height: '60px', width: '100%', position: 'absolute', bottom: 0, backgroundColor: '#e2e8f0' }}>
                        {/* Light Blue Stripe */}
                        <div style={{ flex: 1, backgroundColor: '#7dd3fc', display: 'flex', alignItems: 'center', paddingLeft: '50px', clipPath: 'polygon(0 0, 95% 0, 100% 100%, 0 100%)', position: 'absolute', top: 0, bottom: '15px', left: 0, right: '26%' }}>
                            <span style={{ color: 'white', fontWeight: 'bold', letterSpacing: '1px', fontSize: '14px' }}>www.adrielssystems.com</span>
                        </div>
                        {/* Dark Gray Block */}
                        <div style={{ backgroundColor: '#64748b', width: '30%', position: 'absolute', top: '15px', bottom: 0, right: 0, clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0 100%)' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
