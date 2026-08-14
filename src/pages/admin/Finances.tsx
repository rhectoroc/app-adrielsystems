import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, Plus, Edit2, Trash2, X, Wallet, Landmark, CreditCard, ArrowRightLeft } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'sonner';

export const Finances = () => {
    const [data, setData] = useState<{ summary: any, account_balances: Record<string, number>, transactions: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // CRUD State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [adjustingAccount, setAdjustingAccount] = useState<string | null>(null);
    const [adjustBalanceInput, setAdjustBalanceInput] = useState('');
    const [adjustCurrency, setAdjustCurrency] = useState<'USD'|'VES'>('USD');
    const [editingTx, setEditingTx] = useState<any>(null);
    const [formData, setFormData] = useState({
        type: 'GASTO',
        concept: '',
        amount_usd: '',
        commission_usd: '',
        account_name: 'Efectivo',
        destination_account: 'Zelle',
        created_at: '',
        exchange_rate: ''
    });
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

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
            const isUSD = ['zelle', 'paypal', 'binance'].some(acc => (tx.account_name || '').toLowerCase().includes(acc));
            let initialAmount = parseFloat(tx.amount_usd);
            if (!isUSD) {
                const rate = data?.summary?.bcv_rate || 1;
                initialAmount = initialAmount * rate;
            }

            setEditingTx(tx);
            setFormData({
                type: tx.type,
                concept: tx.concept,
                amount_usd: initialAmount.toFixed(2),
                commission_usd: '',
                account_name: tx.account_name || 'Efectivo',
                destination_account: 'Zelle',
                created_at: new Date(tx.created_at).toISOString().slice(0, 16),
                exchange_rate: tx.exchange_rate ? tx.exchange_rate.toString() : (data?.summary?.bcv_rate?.toString() || '')
            });
        } else {
            setEditingTx(null);
            setFormData({
                type: 'GASTO',
                concept: '',
                amount_usd: '',
                commission_usd: '',
                account_name: 'Efectivo',
                destination_account: 'Zelle',
                created_at: new Date().toISOString().slice(0, 16),
                exchange_rate: data?.summary?.bcv_rate?.toString() || ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let realAmountUsd = parseFloat(formData.amount_usd);
        let realCommissionUsd = parseFloat(formData.commission_usd || '0');
        const isUSD = ['zelle', 'paypal', 'binance'].some(acc => formData.account_name.toLowerCase().includes(acc));

        const rateToUse = formData.exchange_rate ? parseFloat(formData.exchange_rate) : (data?.summary?.bcv_rate || 1);

        if (!isUSD) {
            realAmountUsd = realAmountUsd / rateToUse;
            realCommissionUsd = realCommissionUsd / rateToUse;
        }

        try {
            const payload = {
                type: formData.type,
                concept: formData.concept,
                account_name: formData.account_name,
                commission_usd: formData.commission_usd,
                amount_usd: realAmountUsd,
                amount_ves: !isUSD ? parseFloat(formData.amount_usd) : (realAmountUsd * rateToUse),
                exchange_rate: rateToUse,
                created_at: new Date(formData.created_at).toISOString(),
                ...(editingTx ? { id: editingTx.id } : {})
            };
            
            if (formData.type === 'TRASPASO') {
                if (formData.account_name === formData.destination_account) {
                    throw new Error('La cuenta de origen y destino no pueden ser la misma.');
                }
                const outPayload = {
                    ...payload,
                    type: 'TRANSFERENCIA_SALIDA',
                    concept: formData.concept || `Traspaso a ${formData.destination_account}`
                };
                const inPayload = {
                    ...payload,
                    type: 'TRANSFERENCIA_ENTRADA',
                    account_name: formData.destination_account,
                    concept: formData.concept || `Traspaso desde ${formData.account_name}`
                };

                const resOut = await api.post('/api/finances', outPayload);
                if (!resOut || !resOut.ok) throw new Error('Error al registrar transferencia de salida');
                
                const resIn = await api.post('/api/finances', inPayload);
                if (!resIn || !resIn.ok) throw new Error('Error al registrar transferencia de entrada');
            } else {
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
            }

            if (!editingTx && formData.type !== 'COMISION_BANCARIA' && formData.type !== 'TRASPASO' && realCommissionUsd > 0) {
                const commissionPayload = {
                    type: 'COMISION_BANCARIA',
                    concept: `Comisión bancaria por: ${formData.concept}`,
                    amount_usd: realCommissionUsd,
                    account_name: formData.account_name,
                    created_at: new Date(formData.created_at).toISOString()
                };
                await api.post('/api/finances', commissionPayload);
            }

            setIsModalOpen(false);
            fetchFinances();
            toast.success(editingTx ? 'Transacción actualizada exitosamente' : 'Transacción registrada exitosamente');
        } catch (err: any) {
            console.error('Error saving transaction', err);
            toast.error(`Error al guardar la transacción: ${err.message || ''}`);
        }
    };

    const handleAdjustBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustingAccount || adjustBalanceInput === '') return;
        
        const currentBalanceUsd = data?.account_balances[adjustingAccount] || 0;
        let targetBalanceUsd = parseFloat(adjustBalanceInput);

        if (adjustCurrency === 'VES') {
            const rate = data?.summary?.bcv_rate || 1;
            targetBalanceUsd = targetBalanceUsd / rate;
        }

        const difference = targetBalanceUsd - currentBalanceUsd;
        
        // Use a small epsilon to account for floating point inaccuracies
        if (Math.abs(difference) < 0.001) {
            toast.info('El saldo ingresado es igual al actual');
            setIsAdjustModalOpen(false);
            return;
        }

        try {
            const payload = {
                type: difference > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
                concept: `Ajuste manual de saldo (${difference > 0 ? 'Sobrante' : 'Faltante'})`,
                amount_usd: Math.abs(difference),
                account_name: adjustingAccount,
                created_at: new Date().toISOString()
            };
            
            const res = await api.post('/api/finances', payload);
            if (!res || !res.ok) throw new Error('Error al ajustar el saldo');
            
            setIsAdjustModalOpen(false);
            setAdjustingAccount(null);
            setAdjustBalanceInput('');
            setAdjustCurrency('USD');
            fetchFinances();
            toast.success(`Saldo ajustado exitosamente. Se creó un ${difference > 0 ? 'ajuste positivo' : 'ajuste negativo'} de $${Math.abs(difference).toFixed(2)}`);
        } catch (err: any) {
            toast.error('Error al realizar el ajuste');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar esta transacción?')) return;
        try {
            await api.delete(`/api/finances/${id}`);
            fetchFinances();
            toast.success('Transacción eliminada exitosamente');
        } catch (err) {
            console.error('Error deleting transaction', err);
            toast.error('Error al eliminar la transacción');
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

    const totalPages = Math.ceil((data?.transactions?.length || 0) / itemsPerPage);
    const currentTransactions = data?.transactions?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

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
                        <p className="text-xs text-gray-500 mt-1">~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format(data.summary.total_ingresos * (data.summary.bcv_rate || 0))}</p>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Gastos</p>
                        <p className="text-2xl font-bold text-red-500">{formatMoney(data.summary.total_gastos)}</p>
                        <p className="text-xs text-gray-500 mt-1">~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format(data.summary.total_gastos * (data.summary.bcv_rate || 0))}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors relative group">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Comisiones</p>
                        <p className="text-2xl font-bold text-yellow-500">{formatMoney(data.summary.total_comisiones)}</p>
                        <p className="text-xs text-gray-500 mt-1">~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format(data.summary.total_comisiones * (data.summary.bcv_rate || 0))}</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-lg">
                        <Activity className="w-5 h-5 text-yellow-500" />
                    </div>
                    {/* Tooltip for commission breakdown */}
                    {data.summary.comisiones_por_banco && Object.keys(data.summary.comisiones_por_banco).length > 0 && (
                        <div className="absolute left-0 -bottom-2 translate-y-full w-full bg-slate-800 border border-white/10 rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                            <p className="text-xs font-bold text-white mb-2 uppercase border-b border-white/10 pb-1">Desglose por Banco</p>
                            <div className="space-y-1.5">
                                {Object.entries(data.summary.comisiones_por_banco).map(([bank, amount]) => (
                                    <div key={bank} className="flex justify-between text-xs">
                                        <span className="text-gray-400">{bank}</span>
                                        <span className="font-bold text-yellow-500">{formatMoney(amount as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Balance Neto</p>
                        <p className={`text-2xl font-bold ${data.summary.ganancia_neta >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatMoney(data.summary.ganancia_neta)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format(data.summary.ganancia_neta * (data.summary.bcv_rate || 0))}</p>
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
                        <div key={account} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/[0.07] transition-colors flex flex-col items-center text-center relative group">
                            <div className="p-3 bg-white/5 rounded-full mb-3">
                                {getAccountIcon(account)}
                            </div>
                            <p className="text-xs text-gray-400 font-bold uppercase mb-1">{account}</p>
                            <p className={`text-lg font-bold ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatMoney(balance as number)}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1">
                                Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format((balance as number) * (data.summary.bcv_rate || 0))}
                            </p>
                            <button
                                onClick={() => {
                                    setAdjustingAccount(account);
                                    setAdjustBalanceInput((balance as number).toString());
                                    setAdjustCurrency('USD');
                                    setIsAdjustModalOpen(true);
                                }}
                                className="mt-3 text-[10px] uppercase font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-3 py-1.5 rounded-md transition-colors w-full"
                            >
                                Ajustar Saldo
                            </button>
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
                                <th className="px-4 py-3 font-medium text-right">Monto (VES)</th>
                                <th className="px-4 py-3 font-medium text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {currentTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        No hay transacciones registradas.
                                    </td>
                                </tr>
                            ) : (
                                currentTransactions.map((tx: any) => (
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
                                        <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                            Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format(parseFloat(tx.amount_ves) > 0 ? parseFloat(tx.amount_ves) : (parseFloat(tx.amount_usd) * (parseFloat(tx.exchange_rate) > 0 ? parseFloat(tx.exchange_rate) : (data.summary.bcv_rate || 1))))}
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
                {totalPages > 0 && (
                    <div className="flex justify-between items-center p-4 border-t border-white/10 bg-white/[0.02]">
                        <p className="text-xs text-gray-500">
                            Mostrando {data.transactions.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, data.transactions.length)} de {data.transactions.length}
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm transition-colors"
                            >
                                Anterior
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm transition-colors"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
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
                                        {!editingTx && <option value="TRASPASO">Traspaso entre cuentas</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 font-medium mb-1">
                                        {formData.type === 'TRASPASO' ? 'Cuenta Origen' : 'Cuenta/Banco'}
                                    </label>
                                    <select 
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.account_name}
                                        onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                                    >
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Zelle">Zelle</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Binance">Binance</option>
                                        <option value="Banco de Venezuela">Banco de Venezuela</option>
                                        <option value="Banesco">Banesco</option>
                                        <option value="Banca Amiga">Banca Amiga</option>
                                    </select>
                                </div>
                                {formData.type === 'TRASPASO' && (
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs text-gray-400 font-medium mb-1">Cuenta Destino</label>
                                        <select 
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            value={formData.destination_account}
                                            onChange={(e) => setFormData({...formData, destination_account: e.target.value})}
                                        >
                                            <option value="Efectivo">Efectivo</option>
                                            <option value="Zelle">Zelle</option>
                                            <option value="PayPal">PayPal</option>
                                            <option value="Binance">Binance</option>
                                            <option value="Banco de Venezuela">Banco de Venezuela</option>
                                            <option value="Banesco">Banesco</option>
                                            <option value="Banca Amiga">Banca Amiga</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            {(() => {
                                const isUSD = ['zelle', 'paypal', 'binance'].some(acc => formData.account_name.toLowerCase().includes(acc));
                                return (
                                    <>
                                        <div>
                                            <label className="block text-xs text-gray-400 font-medium mb-1">
                                                Monto ({isUSD ? 'USD' : 'VES'})
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-500">{isUSD ? '$' : 'Bs.'}</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    required
                                                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                    placeholder="0.00"
                                                    value={formData.amount_usd}
                                                    onChange={(e) => setFormData({...formData, amount_usd: e.target.value})}
                                                />
                                            </div>
                                            {!isUSD && formData.amount_usd && (
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    ~ $ {new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(parseFloat(formData.amount_usd) / (parseFloat(formData.exchange_rate) || data.summary.bcv_rate || 1))} USD
                                                </p>
                                            )}
                                        </div>

                                        {!editingTx && formData.type !== 'COMISION_BANCARIA' && formData.type !== 'TRASPASO' && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-xs text-gray-400 font-medium mb-1">
                                                    Comisión Bancaria ({isUSD ? 'USD' : 'VES'}) <span className="text-gray-500 font-normal">(Opcional)</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-gray-500">{isUSD ? '$' : 'Bs.'}</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                                                        placeholder="0.00"
                                                        value={formData.commission_usd}
                                                        onChange={(e) => setFormData({...formData, commission_usd: e.target.value})}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1">Si ingresas un monto, se creará un registro separado de comisión asociado a esta cuenta.</p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

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

                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-xs text-gray-400 font-medium mb-1">Tasa de Cambio (Bs/USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500">Bs.</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            placeholder="Tasa BCV"
                                            value={formData.exchange_rate}
                                            onChange={(e) => setFormData({...formData, exchange_rate: e.target.value})}
                                        />
                                    </div>
                                </div>
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
            {/* Adjust Balance Modal */}
            {isAdjustModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                            <h3 className="font-bold text-lg">Ajustar Saldo: {adjustingAccount}</h3>
                            <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAdjustBalance} className="p-4 space-y-4">
                            <div className="bg-white/5 p-3 rounded-lg border border-white/10 mb-2">
                                <p className="text-xs text-gray-400">Saldo actual registrado:</p>
                                <p className="text-lg font-bold">
                                    {formatMoney(adjustingAccount ? data.account_balances[adjustingAccount] || 0 : 0)} 
                                    <span className="text-sm font-normal text-gray-400 ml-2">
                                        (~ Bs. {new Intl.NumberFormat('es-VE', { style: 'decimal', minimumFractionDigits: 2 }).format((adjustingAccount ? data.account_balances[adjustingAccount] || 0 : 0) * (data?.summary?.bcv_rate || 0))})
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 font-medium mb-1">Saldo Real en la cuenta</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-2.5 text-gray-500">{adjustCurrency === 'USD' ? '$' : 'Bs.'}</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            autoFocus
                                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            placeholder="Ej. 150.00"
                                            value={adjustBalanceInput}
                                            onChange={(e) => setAdjustBalanceInput(e.target.value)}
                                        />
                                    </div>
                                    <select 
                                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none w-24"
                                        value={adjustCurrency}
                                        onChange={(e) => {
                                            setAdjustCurrency(e.target.value as 'USD' | 'VES');
                                            setAdjustBalanceInput('');
                                        }}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="VES">VES</option>
                                    </select>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">El sistema creará un ajuste automático por la diferencia para hacer cuadrar el saldo.</p>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsAdjustModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-black rounded-lg text-sm font-bold transition-colors"
                                >
                                    Guardar Ajuste
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
