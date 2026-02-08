
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ui/ProtectedRoute';

// Layouts
import { AdminLayout } from './components/layouts/AdminLayout';
import { ClientLayout } from './components/layouts/ClientLayout';
import { AuthLayout } from './components/layouts/AuthLayout';

// Pages
import { Login } from './pages/auth/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ClientsManagement } from './pages/admin/ClientsManagement';
import { PaymentsManagement } from './pages/admin/PaymentsManagement';
import { PlansManagement } from './pages/admin/PlansManagement';
import { ClientDashboard } from './pages/client/ClientDashboard';

import { Toaster } from './components/ui/sonner';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Default Route */}
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    {/* Auth Routes */}
                    <Route element={<AuthLayout />}>
                        <Route path="/login" element={<Login />} />
                    </Route>

                    {/* Admin Routes (Protected) */}
                    <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                        <Route path="/admin" element={<AdminLayout />}>
                            <Route index element={<AdminDashboard />} />
                            {/* Add more admin routes here later */}
                            <Route path="clients" element={<ClientsManagement />} />
                            <Route path="payments" element={<PaymentsManagement />} />
                            <Route path="plans" element={<PlansManagement />} />
                            <Route path="settings" element={<div>Settings Placeholder</div>} />
                        </Route>
                    </Route>

                    {/* Client Routes (Protected) */}
                    <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
                        <Route path="/client" element={<ClientLayout />}>
                            <Route index element={<ClientDashboard />} />
                            {/* Add more client routes here later */}
                            <Route path="payments" element={<div>My Payments Placeholder</div>} />
                            <Route path="support" element={<div>Support Placeholder</div>} />
                        </Route>
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
            <Toaster />
        </AuthProvider>
    );
}

export default App;
