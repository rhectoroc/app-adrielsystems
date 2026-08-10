import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Settings as SettingsIcon } from 'lucide-react';
import BackupSection from '../../components/settings/BackupSection';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('backup');

    const tabs = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'backup', label: 'Backups', icon: Database },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-[hsl(var(--bg-deep))]">
            {/* Horizontal Tabs */}
            <div className="border-b border-white/5 bg-black/40 backdrop-blur-md px-8 pt-6 pb-4">
                <h2 className="text-white font-bold font-heading text-2xl tracking-wide mb-6">Configuración</h2>
                <div className="flex gap-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                                    isActive 
                                        ? 'bg-primary/10 text-primary border border-primary/30' 
                                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {activeTab === 'general' && (
                            <div>
                                <h3 className="text-2xl font-bold font-heading text-white mb-6">Configuración General</h3>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                    <p className="text-white/60">Aquí puedes agregar otras sub-secciones en el futuro. (Ej. Perfil, Apariencia, Notificaciones).</p>
                                </div>
                            </div>
                        )}
                        {activeTab === 'backup' && <BackupSection />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Settings;
