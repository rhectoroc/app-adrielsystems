
import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, LifeBuoy, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ClientLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[hsl(var(--bg-deep))] text-white overflow-hidden selection:bg-primary selection:text-white">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-[hsl(var(--bg-deep))] border-b border-white/10 z-50 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Logo" className="h-6" />
                    <span className="font-bold font-heading text-primary">Adriel's</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-40 w-64 bg-black/90 md:bg-black/20 border-r border-white/10 backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 mt-14 md:mt-0">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Adriel's Systems" className="h-8" />
                        <h1 className="text-lg font-bold text-primary font-heading tracking-wider">Adriel's Systems</h1>
                    </div>
                </div>
                <nav className="mt-6 flex-1 px-4 space-y-2">
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/client" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500 group-hover:text-primary transition-colors" />
                        Dashboard
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/client/payments" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <CreditCard className="w-5 h-5 mr-3 text-gray-500 group-hover:text-secondary transition-colors" />
                        Payments
                    </Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/client/support" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <LifeBuoy className="w-5 h-5 mr-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                        Support
                    </Link>
                </nav>
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gradient-to-br from-[hsl(var(--bg-deep))] to-[hsl(var(--bg-dark))] relative pt-16 md:pt-0">
                {/* Background Glow Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]"></div>
                </div>

                <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};
