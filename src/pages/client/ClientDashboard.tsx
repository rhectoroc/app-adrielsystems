

export const ClientDashboard = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
            <div className="p-6 bg-white rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold text-gray-800">Welcome back, Client!</h2>
                <p className="mt-2 text-gray-600">Here is an overview of your services and payments.</p>
            </div>

            {/* Service Status Placeholder */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="p-6 bg-white rounded-lg shadow-sm border-l-4 border-green-500">
                    <h3 className="text-lg font-medium text-gray-900">Hosting Service</h3>
                    <p className="mt-1 text-sm text-gray-500">Status: <span className="text-green-600 font-semibold">Active</span></p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm border-l-4 border-yellow-500">
                    <h3 className="text-lg font-medium text-gray-900">Next Payment</h3>
                    <p className="mt-1 text-sm text-gray-500">Due: <span className="text-gray-900 font-semibold">Oct 15, 2023</span></p>
                </div>
            </div>
        </div>
    );
};
