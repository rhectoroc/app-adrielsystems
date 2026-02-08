
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Users, BarChart3, Settings, LogOut, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[hsl(var(--bg-deep))] text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-black/40 border-r border-white/10 flex flex-col backdrop-blur-md">
                <div className="p-6">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Logo" className="h-6 opacity-80" />
                        <h1 className="text-lg font-bold font-heading tracking-wider">Admin Console</h1>
                    </div>
                </div>
                <nav className="mt-6 flex-1 px-4 space-y-2">
                    <Link to="/admin" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <BarChart3 className="w-5 h-5 mr-3 group-hover:text-primary transition-colors" />
                        Overview
                    </Link>
                    <Link to="/admin/clients" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <Users className="w-5 h-5 mr-3 group-hover:text-secondary transition-colors" />
                        Clients
                    </Link>
                    <Link to="/admin/payments" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <Wallet className="w-5 h-5 mr-3 group-hover:text-yellow-400 transition-colors" />
                        Payments
                    </Link>
                    <Link to="/admin/settings" className="flex items-center px-4 py-3 text-gray-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group">
                        <Settings className="w-5 h-5 mr-3 group-hover:text-gray-200 transition-colors" />
                        Settings
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
            <main className="flex-1 overflow-auto bg-gradient-to-br from-[hsl(var(--bg-deep))] to-[hsl(var(--bg-dark))] relative">
                {/* Background Glow Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
                </div>
                <div className="relative z-10 p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
