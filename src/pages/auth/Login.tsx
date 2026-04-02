/// <reference types="vite/client" />

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login, isAuthenticated, role, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Redirect if already authenticated
    React.useEffect(() => {
        if (!authLoading && isAuthenticated) {
            if (role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/client');
            }
        }
    }, [isAuthenticated, role, authLoading, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.PROD ? '/api/auth/login' : 'http://localhost:3000/api/auth/login';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Credenciales inválidas');
            }

            login(data.token, data.role, data.user);
            toast.success(`¡Bienvenido de nuevo, ${data.user.name || 'Usuario'}!`);

            if (data.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/client');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4 bg-[#05080f] overflow-hidden"
            style={{
                background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)'
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-[360px] p-8 rounded-2xl bg-white/[0.02] backdrop-blur-2xl border border-white/5 shadow-2xl relative overflow-hidden"
            >
                {/* Accent Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-secondary/50 opacity-50" />

                <div className="flex justify-center mb-6">
                    <img
                        src="/logo.png"
                        alt="Adriel's Systems"
                        className="h-8 w-auto object-contain opacity-90 brightness-110"
                    />
                </div>

                <div className="text-center mb-6">
                    <h1 className="text-lg font-black text-white font-heading tracking-[0.2em] uppercase leading-none mb-1">
                        Acceso Centralizado
                    </h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        Gestión de Servicios & Infraestructura
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                            Credencial de Usuario
                        </label>
                        <div className="relative group">
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white outline-none focus:border-primary/50 transition-all placeholder-gray-700"
                                placeholder="E-mail Corporativo"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                            Clave de Seguridad
                        </label>
                        <div className="relative group">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-xs text-white outline-none focus:border-primary/50 transition-all placeholder-gray-700 pr-10"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 px-1 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-end">
                        <button type="button" className="text-[9px] font-black uppercase tracking-tighter text-primary/60 hover:text-primary transition-colors">
                            Recuperar Acceso
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-2.5 bg-primary hover:bg-primary/90 text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-primary/10"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Autenticar'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                        ¿Requieres Asistencia? <br/>
                        <button className="text-white hover:text-primary transition-colors mt-1 underline decoration-primary/30">
                            Contactar Soporte IT
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
