
import { Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, CreditCard, LifeBuoy, LogOut } from 'lucide-react';

export const ClientLayout = () => {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-blue-600">Adriel's Systems</h1>
                </div>
                <nav className="mt-6">
                    <Link to="/client" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                        <LayoutDashboard className="w-5 h-5 mr-3" />
                        Dashboard
                    </Link>
                    <Link to="/client/payments" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                        <CreditCard className="w-5 h-5 mr-3" />
                        Payments
                    </Link>
                    <Link to="/client/support" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                        <LifeBuoy className="w-5 h-5 mr-3" />
                        Support
                    </Link>
                </nav>
                <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-red-600">
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
