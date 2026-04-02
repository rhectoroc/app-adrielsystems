import { useState, useEffect } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Calendar, Loader2 } from 'lucide-react';
import { formatSafeDate } from '../../utils/dateUtils';
import { api } from '../../utils/api';

interface Payment {
    id: number;
    amount: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    payment_date: string;
    service_month: string;
    client_name: string;
    company_name: string;
    n8n_reference_id?: string;
}

export const PaymentsOverview = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const response = await api.get('/api/payments');
            if (response.ok) {
                const data = await response.json();
                setPayments(data);
            }
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'PAID': return 'text-green-500 bg-green-500/10 border-green-500/10';
            case 'PENDING': return 'text-amber-500 bg-amber-500/10 border-amber-500/10';
            case 'OVERDUE': return 'text-red-500 bg-red-500/10 border-red-500/10';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/10';
        }
    };

    const filteredPayments = payments.filter(payment => {
        const matchesSearch =
            payment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.amount.includes(searchTerm);

        const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const totalRevenue = payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const pendingAmount = payments
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const overdueAmount = payments
        .filter(p => p.status === 'OVERDUE')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white font-heading tracking-tight">Reporte de Pagos</h2>
                    <p className="text-gray-400 text-[11px] mt-0.5">Visión consolidada de ingresos y cobros pendientes.</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-lg transition-all border border-white/5 text-[11px] font-black uppercase tracking-widest">
                        <Download className="w-3.5 h-3.5" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Stats Cards - High Density */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Recaudación Total</p>
                        <div className="p-1.5 bg-green-500/10 rounded-md text-green-500">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <p className="text-lg font-black text-white">${totalRevenue.toLocaleString()}</p>
                        <p className="text-[10px] text-green-500/60 font-bold uppercase tracking-tighter">EFECTIVADO</p>
                    </div>
                </div>

                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Por Cobrar</p>
                        <div className="p-1.5 bg-amber-500/10 rounded-md text-amber-500">
                            <Calendar className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <p className="text-lg font-black text-white">${pendingAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-tighter">PENDIENTE</p>
                    </div>
                </div>

                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-start">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">En Mora</p>
                        <div className="p-1.5 bg-red-500/10 rounded-md text-red-500">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <p className="text-lg font-black text-white">${overdueAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-red-500/60 font-bold uppercase tracking-tighter">CRÍTICO</p>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs focus:outline-none focus:border-primary/50 text-white placeholder-gray-600"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hide">
                        <Filter className="w-3 h-3 text-gray-600 mr-1" />
                        {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-2.5 py-1 rounded text-[10px] font-black border transition-all uppercase tracking-widest ${statusFilter === status
                                        ? 'bg-primary/20 text-primary border-primary/20'
                                        : 'bg-transparent text-gray-500 border-transparent hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {status === 'ALL' ? 'TODOS' : status === 'PAID' ? 'PAGADOS' : status === 'PENDING' ? 'PENDIENTES' : 'MORA'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="glass-card overflow-hidden border border-white/5">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                                <tr>
                                    <th className="p-3">Identidad del Cliente</th>
                                    <th className="p-3 text-right">Inversión</th>
                                    <th className="p-3 text-center">Estado</th>
                                    <th className="p-3">Registro / Periodo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-30" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Procesando registros financieros...</span>
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-gray-600 italic text-[11px]">
                                            No se localizaron pagos bajo estos criterios.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0 group">
                                            <td className="p-3">
                                                <div>
                                                    <p className="font-black text-white text-[13px] group-hover:text-primary transition-colors">{payment.client_name}</p>
                                                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">{payment.company_name || 'Particular'}</p>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-[13px] font-black text-white">${parseFloat(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    <span className="text-[9px] text-gray-600 font-bold uppercase italic tracking-tighter">USD NETO</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-widest ${getStatusStyles(payment.status)}`}>
                                                    {payment.status === 'PAID' ? 'EFECTIVADO' : payment.status === 'PENDING' ? 'PENDIENTE' : 'MORA'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                                        <Calendar className="w-2.5 h-2.5 text-gray-600" />
                                                        <span>Registrado: {formatSafeDate(payment.payment_date)}</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-600 italic font-medium">Ciclo: {formatSafeDate(payment.service_month)}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
