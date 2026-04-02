
import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Users, BarChart3, Settings, LogOut, Wallet, Menu, X, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[hsl(var(--bg-deep))] text-white overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-[hsl(var(--bg-deep))] border-b border-white/10 z-50 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Logo" className="h-6" />
                    <span className="font-bold font-heading">Admin</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-40 w-48 bg-black/95 md:bg-black/60 border-r border-white/5 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-3 mt-14 md:mt-0 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Logo" className="h-4 opacity-100 brightness-110" />
                        <h1 className="text-xs font-black font-heading tracking-[0.15em] text-white uppercase">Sistemas</h1>
                    </div>
                </div>
                <nav className="mt-4 flex-1 px-2 space-y-0.5">
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/admin" className="flex items-center px-2.5 py-1.5 text-gray-400 rounded-md hover:bg-white/5 hover:text-white transition-all group text-[11px] font-bold uppercase tracking-wider">
                        <BarChart3 className="w-3.5 h-3.5 mr-3 group-hover:text-primary transition-colors" />
                        Resumen
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/admin/clients" className="flex items-center px-2.5 py-1.5 text-gray-400 rounded-md hover:bg-white/5 hover:text-white transition-all group text-[11px] font-bold uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 mr-3 group-hover:text-secondary transition-colors" />
                        Clientes
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/admin/payments" className="flex items-center px-2.5 py-1.5 text-gray-400 rounded-md hover:bg-white/5 hover:text-white transition-all group text-[11px] font-bold uppercase tracking-wider">
                        <Wallet className="w-3.5 h-3.5 mr-3 group-hover:text-yellow-500 transition-colors" />
                        Pagos
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/admin/plans" className="flex items-center px-2.5 py-1.5 text-gray-400 rounded-md hover:bg-white/5 hover:text-white transition-all group text-[11px] font-bold uppercase tracking-wider">
                        <Tag className="w-3.5 h-3.5 mr-3 group-hover:text-green-500 transition-colors" />
                        Planes
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/admin/settings" className="flex items-center px-2.5 py-1.5 text-gray-400 rounded-md hover:bg-white/5 hover:text-white transition-all group text-[11px] font-bold uppercase tracking-wider">
                        <Settings className="w-3.5 h-3.5 mr-3 group-hover:text-gray-300 transition-colors" />
                        Configuración
                    </Link>
                </nav>
                <div className="p-3 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 hover:bg-red-500/5 rounded-md transition-all group"
                    >
                        <LogOut className="w-3.5 h-3.5 mr-2 group-hover:rotate-12 transition-transform" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[hsl(var(--bg-deep))] relative pt-16 md:pt-0 custom-scrollbar">
                {/* Background Glow Effects (High Density - Sutil) */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-20">
                    <div className="absolute top-[-10%] right-[-5%] w-[30%] h-[30%] bg-primary/2 rounded-full blur-[80px]"></div>
                </div>
                <div className="relative z-10 p-4 max-w-full lg:max-w-7xl mx-auto space-y-4">
                    <Outlet />
                </div>
            </main>

            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};
