
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Info } from 'lucide-react';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success' | 'warning';
    icon?: React.ReactNode;
}

interface ConfirmDialogProps {
    isOpen: boolean;
    options: ConfirmOptions;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, options, onConfirm, onCancel }) => {
    const { title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'info' } = options;

    const getIcon = () => {
        if (options.icon) return options.icon;
        switch (type) {
            case 'danger': return <AlertTriangle className="w-6 h-6 text-red-500" />;
            case 'success': return <Check className="w-6 h-6 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
            default: return <Info className="w-6 h-6 text-blue-500" />;
        }
    };

    const getConfirmButtonClass = () => {
        switch (type) {
            case 'danger': return 'bg-red-500 hover:bg-red-600 focus:ring-red-500';
            case 'success': return 'bg-green-500 hover:bg-green-600 focus:ring-green-500';
            case 'warning': return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500';
            default: return 'bg-primary hover:bg-primary/90 focus:ring-primary';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-[#0f1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header Decoration */}
                        <div className={`h-1 w-full ${type === 'danger' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-amber-500' : 'bg-primary'}`} />

                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full bg-white/5 shrink-0 ${type === 'danger' ? 'bg-red-500/10' : ''}`}>
                                    {getIcon()}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white mb-2">
                                        {title}
                                    </h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        {message}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-lg shadow-black/20 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f1115] ${getConfirmButtonClass()}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
