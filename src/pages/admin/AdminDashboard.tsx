

export const AdminDashboard = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900">Total Clients</h3>
                    <p className="mt-2 text-3xl font-bold text-blue-600">12</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900">Monthly Revenue</h3>
                    <p className="mt-2 text-3xl font-bold text-green-600">$1,200</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900">Pending Payments</h3>
                    <p className="mt-2 text-3xl font-bold text-red-600">3</p>
                </div>
            </div>
        </div>
    );
};
