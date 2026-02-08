
import { Outlet, Link } from 'react-router-dom';
import { Users, BarChart3, Settings, LogOut, Wallet } from 'lucide-react';

export const AdminLayout = () => {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white">
                <div className="p-6">
                    <h1 className="text-xl font-bold">Admin Console</h1>
                </div>
                <nav className="mt-6">
                    <Link to="/admin" className="flex items-center px-6 py-3 text-gray-300 hover:bg-slate-800 hover:text-white">
                        <BarChart3 className="w-5 h-5 mr-3" />
                        Overview
                    </Link>
                    <Link to="/admin/clients" className="flex items-center px-6 py-3 text-gray-300 hover:bg-slate-800 hover:text-white">
                        <Users className="w-5 h-5 mr-3" />
                        Clients
                    </Link>
                    <Link to="/admin/payments" className="flex items-center px-6 py-3 text-gray-300 hover:bg-slate-800 hover:text-white">
                        <Wallet className="w-5 h-5 mr-3" />
                        Payments
                    </Link>
                    <Link to="/admin/settings" className="flex items-center px-6 py-3 text-gray-300 hover:bg-slate-800 hover:text-white">
                        <Settings className="w-5 h-5 mr-3" />
                        Settings
                    </Link>
                </nav>
                <div className="absolute bottom-0 w-64 p-4 border-t border-slate-800">
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-400 hover:text-white">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
