import { useState, useEffect } from 'react';
import { Plus, Loader2, Save, Trash2, Edit, Shield, ShieldCheck, User, Bell, BellOff, Eye, EyeOff, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';

interface UserRecord {
    id: number;
    email: string;
    role: 'ADMIN' | 'EMPLOYEE' | 'CLIENT';
    client_id: number | null;
    client_name: string | null;
    receive_notifications: boolean;
    phone: string | null;
    created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Shield }> = {
    ADMIN: { label: 'Admin', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: ShieldCheck },
    EMPLOYEE: { label: 'Empleado', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Shield },
    CLIENT: { label: 'Cliente', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: User },
};

export const UsersManagement = () => {
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'EMPLOYEE' as string,
        phone: '',
        receive_notifications: true,
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleEdit = (user: UserRecord) => {
        setEditMode(true);
        setCurrentUserId(user.id);
        setFormData({
            email: user.email,
            password: '',
            role: user.role,
            phone: user.phone || '',
            receive_notifications: user.receive_notifications || false,
        });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleDelete = async (user: UserRecord) => {
        if (currentUser && user.id === Number(currentUser.id)) {
            toast.error('No puedes eliminar tu propia cuenta');
            return;
        }

        const confirmed = await confirm({
            title: 'Eliminar Usuario',
            message: `¿Estás seguro de eliminar a "${user.email}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            type: 'danger',
        });

        if (!confirmed) return;

        try {
            const response = await api.delete(`/api/users/${user.id}`);
            if (response.ok) {
                toast.success('Usuario eliminado exitosamente');
                fetchUsers();
            } else {
                const data = await response.json();
                toast.error(data.message || 'Error al eliminar usuario');
            }
        } catch (error) {
            toast.error('Error al eliminar usuario');
        }
    };

    const handleNew = () => {
        setEditMode(false);
        setCurrentUserId(null);
        setFormData({ email: '', password: '', role: 'EMPLOYEE', phone: '', receive_notifications: true });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload: Record<string, unknown> = {
                email: formData.email,
                role: formData.role,
                phone: formData.phone || null,
                receive_notifications: formData.receive_notifications,
            };

            // Only send password if provided
            if (formData.password.trim() !== '') {
                payload.password = formData.password;
            } else if (!editMode) {
                toast.error('La contraseña es requerida para nuevos usuarios');
                setIsSubmitting(false);
                return;
            }

            const response = editMode && currentUserId
                ? await api.put(`/api/users/${currentUserId}`, payload)
                : await api.post('/api/users', payload);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || (editMode ? 'Error al actualizar' : 'Error al crear'));
            }

            toast.success(editMode ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
            setIsModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message || 'Error al procesar la solicitud');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    // Stats
    const adminCount = users.filter(u => u.role === 'ADMIN').length;
    const employeeCount = users.filter(u => u.role === 'EMPLOYEE').length;
    const clientCount = users.filter(u => u.role === 'CLIENT').length;
    const notifCount = users.filter(u => u.receive_notifications).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white font-heading">Gestión de Usuarios</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Administración de accesos, roles y notificaciones del sistema.</p>
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-xs font-black uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Usuario
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-red-500/10 rounded"><ShieldCheck className="w-3.5 h-3.5 text-red-400" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Admins</p>
                            <p className="text-lg font-black text-white">{adminCount}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded"><Shield className="w-3.5 h-3.5 text-blue-400" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Empleados</p>
                            <p className="text-lg font-black text-white">{employeeCount}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded"><User className="w-3.5 h-3.5 text-emerald-400" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Clientes</p>
                            <p className="text-lg font-black text-white">{clientCount}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-3 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-500/10 rounded"><Bell className="w-3.5 h-3.5 text-yellow-400" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Notificaciones</p>
                            <p className="text-lg font-black text-white">{notifCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center p-12 opacity-50">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : (
                <div className="glass-card border border-white/5 overflow-hidden bg-white/[0.01]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Email</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Rol</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden md:table-cell">Teléfono</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden lg:table-cell">Cliente Asociado</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Notif.</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden md:table-cell">Registrado</th>
                                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.CLIENT;
                                    const RoleIcon = roleConf.icon;
                                    const isSelf = currentUser && user.id === Number(currentUser.id);

                                    return (
                                        <tr key={user.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-white">{user.email}</span>
                                                    {isSelf && (
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">Tú</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${roleConf.bg} ${roleConf.color}`}>
                                                    <RoleIcon className="w-3 h-3" />
                                                    {roleConf.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 hidden md:table-cell">
                                                {user.phone ? (
                                                    <span className="text-xs text-gray-300 flex items-center gap-1">
                                                        <Phone className="w-3 h-3 text-gray-600" />
                                                        {user.phone}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic">Sin teléfono</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 hidden lg:table-cell">
                                                {user.client_name ? (
                                                    <span className="text-xs text-gray-300">{user.client_name}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                {user.receive_notifications ? (
                                                    <Bell className="w-3.5 h-3.5 text-yellow-400 mx-auto" />
                                                ) : (
                                                    <BellOff className="w-3.5 h-3.5 text-gray-600 mx-auto" />
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 hidden md:table-cell">
                                                <span className="text-[11px] text-gray-500">{formatDate(user.created_at)}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    {!isSelf && (
                                                        <button
                                                            onClick={() => handleDelete(user)}
                                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-gray-600 text-xs italic">
                                            No hay usuarios registrados en el sistema.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                {editMode ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                {editMode ? 'Modifica los datos del usuario. Deja la contraseña vacía para mantener la actual.' : 'Crea un nuevo acceso al sistema.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Email */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Correo Electrónico</label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                    placeholder="usuario@empresa.com"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                    Contraseña {editMode && <span className="text-gray-600 normal-case tracking-normal">(dejar vacía para no cambiar)</span>}
                                </label>
                                <div className="relative">
                                    <input
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required={!editMode}
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-1.5 pr-9 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                        placeholder={editMode ? '••••••••' : 'Mínimo 6 caracteres'}
                                        minLength={editMode && formData.password === '' ? 0 : 6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Role + Phone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Rol</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50"
                                    >
                                        <option value="ADMIN">Administrador</option>
                                        <option value="EMPLOYEE">Empleado</option>
                                        <option value="CLIENT">Cliente</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Teléfono WhatsApp</label>
                                    <input
                                        name="phone"
                                        type="text"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 focus:outline-none"
                                        placeholder="584140000000"
                                    />
                                </div>
                            </div>

                            {/* Notifications Toggle */}
                            <div className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-yellow-400" />
                                    <div>
                                        <p className="text-xs font-bold text-white">Recibir Notificaciones</p>
                                        <p className="text-[10px] text-gray-500">Reportes de pagos y alertas del sistema vía WhatsApp</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="receive_notifications"
                                        checked={formData.receive_notifications}
                                        onChange={handleInputChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary/90 text-black rounded-lg transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    {editMode ? 'Actualizar' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
