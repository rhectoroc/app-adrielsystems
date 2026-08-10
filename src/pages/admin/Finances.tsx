import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle } from 'lucide-react';
import { api } from '../../utils/api';

export const Finances = () => {
    const [data, setData] = useState<{ summary: any, transactions: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchFinances();
    }, []);

    const fetchFinances = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/finances');
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
        if (type === 'INGRESO' || type === 'ENTRADA') return 'text-green-500 bg-green-500/10 border-green-500/20';
        if (type === 'GASTO' || type === 'SALIDA') return 'text-red-500 bg-red-500/10 border-red-500/20';
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'; // COMISION_BANCARIA
    };

    const getTypeLabel = (type: string) => {
        if (type === 'INGRESO' || type === 'ENTRADA') return 'Ingreso';
        if (type === 'GASTO' || type === 'SALIDA') return 'Gasto';
        if (type === 'COMISION_BANCARIA') return 'Comisión';
        return type;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-heading">Finanzas</h1>
                    <p className="text-sm text-gray-400">Control de ingresos, gastos y comisiones</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            </div>

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
                                <th className="px-4 py-3 font-medium">Tipo</th>
                                <th className="px-4 py-3 font-medium">Concepto</th>
                                <th className="px-4 py-3 font-medium text-right">Monto (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        No hay transacciones registradas.
                                    </td>
                                </tr>
                            ) : (
                                data.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-gray-300">
                                            {new Date(tx.created_at).toLocaleString('es-VE')}
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
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
