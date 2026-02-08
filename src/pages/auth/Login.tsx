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
    const { login } = useAuth();
    const navigate = useNavigate();

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
                throw new Error(data.message || 'Invalid credentials');
            }

            login(data.token, data.role, data.user);
            toast.success(`Welcome back, ${data.user.name || 'User'}!`);

            if (data.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/client');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_left,#1a2a4a,#0a101c)]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[450px] p-12 rounded-3xl bg-white/3 backdrop-blur-xl border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.5)]"
            >
                <div className="flex justify-center mb-8">
                    <img
                        src="/logo.png"
                        alt="Adriel's Systems"
                        className="w-full max-w-[250px] h-auto object-contain"
                    />
                </div>

                <h1 className="text-3xl text-center text-white font-heading mb-2">Panel de Clientes</h1>
                <p className="text-center text-[#aaa] text-sm mb-10">Ingresa tus credenciales para acceder</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="email" className="text-sm text-[#eee]">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white outline-none focus:border-[#0070f3] transition-colors placeholder-gray-500"
                            placeholder="correo@ejemplo.com"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm text-[#eee]">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white outline-none focus:border-[#0070f3] transition-colors placeholder-gray-500 pr-12"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-4 py-4 bg-[#0070f3] hover:bg-[#0060d0] text-white font-semibold rounded-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Entrar'}
                    </button>

                    <div className="text-right">
                        <a href="#" className="text-xs text-[#0070f3] hover:underline">¿Olvidaste tu contraseña?</a>
                    </div>
                </form>

                <div className="mt-8 text-center text-sm text-[#888]">
                    <span>¿No tienes cuenta? <a href="#" className="text-white hover:underline font-medium">Ponte en contacto</a></span>
                </div>
            </motion.div>
        </div>
    );
};
