import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, Plus, Edit2, Trash2, X, Wallet, Landmark, CreditCard, ArrowRightLeft } from 'lucide-react';
import { api } from '../../utils/api';

export const Finances = () => {
    const [data, setData] = useState<{ summary: any, account_balances: Record<string, number>, transactions: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // CRUD State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);
    const [formData, setFormData] = useState({
        type: 'GASTO',
        concept: '',
        amount_usd: '',
        account_name: 'Efectivo',
        created_at: ''
    });

    useEffect(() => {
        fetchFinances();
    }, []);

    const fetchFinances = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/api/finances?t=${new Date().getTime()}`);
            if (response.ok) {
                const json = await response.json();
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching finances', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (tx: any = null) => {
        if (tx) {
            setEditingTx(tx);
            setFormData({
                type: tx.type,
                concept: tx.concept,
                amount_usd: tx.amount_usd.toString(),
                account_name: tx.account_name || 'Efectivo',
                created_at: new Date(tx.created_at).toISOString().slice(0, 16)
            });
        } else {
            setEditingTx(null);
            setFormData({
                type: 'GASTO',
                concept: '',
                amount_usd: '',
                account_name: 'Efectivo',
                created_at: new Date().toISOString().slice(0, 16)
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                amount_usd: parseFloat(formData.amount_usd),
                created_at: new Date(formData.created_at).toISOString(),
                ...(editingTx ? { id: editingTx.id } : {})
            };
            
            const res = await api.post('/api/finances', payload);

            if (!res || !res.ok) {
                let errorMsg = res ? `HTTP ${res.status}` : 'Error de red';
                try {
                    if (res) {
                        const errData = await res.json();
                        if (errData.message) errorMsg += `: ${errData.message}`;
                    }
                } catch(e) {}
                throw new Error(errorMsg);
            }

            setIsModalOpen(false);
            fetchFinances();
        } catch (err: any) {
            console.error('Error saving transaction', err);
            alert(`Error al guardar la transacción: ${err.message || ''}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar esta transacción?')) return;
        try {
            await api.delete(`/api/finances/${id}`);
            fetchFinances();
        } catch (err) {
            console.error('Error deleting transaction', err);
            alert('Error al eliminar la transacción');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center text-gray-400 py-10">
                <AlertCircle className="w-10 h-10 mx-auto mb-4 text-gray-500" />
                <p>No se pudo cargar la información financiera.</p>
            </div>
        );
    }

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const getTypeColor = (type: string) => {
        if (type === 'INGRESO' || type === 'ENTRADA' || type === 'TRANSFERENCIA_ENTRADA') return 'text-green-500 bg-green-500/10 border-green-500/20';
        if (type === 'GASTO' || type === 'SALIDA' || type === 'TRANSFERENCIA_SALIDA') return 'text-red-500 bg-red-500/10 border-red-500/20';
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'; 
    };

    const getTypeLabel = (type: string) => {
        if (type === 'INGRESO' || type === 'ENTRADA') return 'Ingreso';
        if (type === 'GASTO' || type === 'SALIDA') return 'Gasto';
        if (type === 'COMISION_BANCARIA') return 'Comisión';
        if (type === 'TRANSFERENCIA_SALIDA') return 'Transf. Salida';
        if (type === 'TRANSFERENCIA_ENTRADA') return 'Transf. Entrada';
        return type;
    };
    
    const getAccountIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('zelle')) return <DollarSign className="w-5 h-5 text-[#741bd1]" />;
        if (lower.includes('paypal')) return <CreditCard className="w-5 h-5 text-[#003087]" />;
        if (lower.includes('banesco') || lower.includes('venezuela') || lower.includes('amiga')) return <Landmark className="w-5 h-5 text-blue-400" />;
        return <Wallet className="w-5 h-5 text-green-400" />;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-heading">Finanzas</h1>
                    <p className="text-sm text-gray-400">Control de ingresos, gastos y cuentas bancarias</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Añadir Transacción
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Ingresos</p>
                        <p className="text-2xl font-bold text-green-500">{formatMoney(data.summary.total_ingresos)}</p>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Gastos</p>
                        <p className="text-2xl font-bold text-red-500">{formatMoney(data.summary.total_gastos)}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Comisiones</p>
                        <p className="text-2xl font-bold text-yellow-500">{formatMoney(data.summary.total_comisiones)}</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-lg">
                        <Activity className="w-5 h-5 text-yellow-500" />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Balance Neto</p>
                        <p className={`text-2xl font-bold ${data.summary.ganancia_neta >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatMoney(data.summary.ganancia_neta)}
                        </p>
                    </div>
                    <div className={`p-3 rounded-lg ${data.summary.ganancia_neta >= 0 ? 'bg-primary/20' : 'bg-red-500/10'}`}>
                        <DollarSign className={`w-5 h-5 ${data.summary.ganancia_neta >= 0 ? 'text-primary' : 'text-red-400'}`} />
                    </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Tasa BCV</p>
                        <p className="text-2xl font-bold text-blue-400">Bs. {data.summary.bcv_rate ? data.summary.bcv_rate.toFixed(2) : '---'}</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                        <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                    </div>
                </div>
            </div>
            
            {/* Bank Accounts Section */}
            {(() => {
                const totalUSD = Object.values(data.account_balances || {}).reduce((acc, val) => acc + (val as number), 0);
                const totalVES = totalUSD * (data.summary.bcv_rate || 0);
                
                return (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold flex items-center gap-2">
                                <Landmark className="w-5 h-5 text-primary" /> 
                                Saldos por Cuenta
                            </h2>
                            <div className="text-sm font-bold bg-white/5 border border-white/10 px-4 py-2 rounded-lg hidden sm:block">
                                Total Liquidez: <span className="text-primary">{formatMoney(totalUSD)}</span> 
                                <span className="text-gray-400 font-normal ml-2">
                                    (~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalVES)})
                                </span>
                            </div>
                        </div>
                        
                        {/* Mobile total badge */}
                        <div className="text-sm font-bold bg-white/5 border border-white/10 px-4 py-3 rounded-lg sm:hidden mb-4 text-center">
                            Total Liquidez: <span className="text-primary">{formatMoney(totalUSD)}</span> <br/>
                            <span className="text-gray-400 font-normal text-xs">
                                (~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalVES)})
                            </span>
                        </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(data.account_balances || {}).map(([account, balance]) => (
                        <div key={account} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/[0.07] transition-colors flex flex-col items-center text-center">
                            <div className="p-3 bg-white/5 rounded-full mb-3">
                                {getAccountIcon(account)}
                            </div>
                            <p className="text-xs text-gray-400 font-bold uppercase mb-1">{account}</p>
                            <p className={`text-lg font-bold ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatMoney(balance as number)}
                            </p>
                        </div>
                    ))}
                    {Object.keys(data.account_balances || {}).length === 0 && (
                        <div className="col-span-full text-center py-6 text-gray-500 bg-white/5 rounded-xl border border-white/10">
                            No hay saldos registrados aún.
                        </div>
                    )}
                </div>
            </div>
            );})()}

            {/* Transactions Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                    <h2 className="font-bold">Historial de Transacciones</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-black/40">
                            <tr>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                                <th className="px-4 py-3 font-medium">Cuenta</th>
                                <th className="px-4 py-3 font-medium">Tipo</th>
                                <th className="px-4 py-3 font-medium">Concepto</th>
                                <th className="px-4 py-3 font-medium text-right">Monto (USD)</th>
                                <th className="px-4 py-3 font-medium text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No hay transacciones registradas.
                                    </td>
                                </tr>
                            ) : (
                                data.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-gray-300">
                                            {new Date(tx.created_at).toLocaleString('es-VE')}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-400">
                                            {tx.account_name || 'Efectivo'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md border ${getTypeColor(tx.type)}`}>
                                                {getTypeLabel(tx.type)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{tx.concept}</td>
                                        <td className="px-4 py-3 text-right font-bold">
                                            {formatMoney(parseFloat(tx.amount_usd))}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleOpenModal(tx)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors" title="Editar">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* CRUD Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                            <h3 className="font-bold text-lg">{editingTx ? 'Editar Transacción' : 'Añadir Transacción'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 font-medium mb-1">Tipo de Movimiento</label>
                                    <select 
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.type}
                                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    >
                                        <option value="INGRESO">Ingreso</option>
                                        <option value="GASTO">Gasto</option>
                                        <option value="COMISION_BANCARIA">Comisión Bancaria</option>
                                        <option value="TRANSFERENCIA_SALIDA">Transferencia (Salida)</option>
                                        <option value="TRANSFERENCIA_ENTRADA">Transferencia (Entrada)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 font-medium mb-1">Cuenta/Banco</label>
                                    <select 
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.account_name}
                                        onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                                    >
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Zelle">Zelle</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Banco de Venezuela">Banco de Venezuela</option>
                                        <option value="Banesco">Banesco</option>
                                        <option value="Banca Amiga">Banca Amiga</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs text-gray-400 font-medium mb-1">Monto (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="0.00"
                                        value={formData.amount_usd}
                                        onChange={(e) => setFormData({...formData, amount_usd: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 font-medium mb-1">Concepto / Descripción</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Ej. Pago de internet, Compra de equipos..."
                                    value={formData.concept}
                                    onChange={(e) => setFormData({...formData, concept: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 font-medium mb-1">Fecha de Registro</label>
                                <input 
                                    type="datetime-local" 
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    value={formData.created_at}
                                    onChange={(e) => setFormData({...formData, created_at: e.target.value})}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-black rounded-lg text-sm font-bold transition-colors"
                                >
                                    {editingTx ? 'Guardar Cambios' : 'Añadir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
