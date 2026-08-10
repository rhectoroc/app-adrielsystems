import React, { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../utils/api';

const BackupSection = () => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/backup/download', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Error al descargar');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `adrielssystems-backup-${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast.success('Backup descargado exitosamente');
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error al generar el backup');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setShowWarning(true);
        }
    };

    const handleRestore = async () => {
        if (!selectedFile) return;
        setIsRestoring(true);
        setShowWarning(false);

        const formData = new FormData();
        formData.append('backup', selectedFile);

        try {
            await api.post('/api/backup/restore', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Sistema restaurado exitosamente. Recargando...', { duration: 5000 });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error(error);
            toast.error('Error al restaurar el sistema. Verifica el archivo ZIP.');
        } finally {
            setIsRestoring(false);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="max-w-4xl">
            <h3 className="text-2xl font-bold font-heading text-white mb-2">Backups y Restauración</h3>
            <p className="text-white/60 mb-8">Exporta o importa toda la información de la base de datos.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Download className="w-24 h-24 text-primary" />
                    </div>
                    <div className="relative z-10">
                        <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <Download className="w-5 h-5 text-primary" /> Exportar Datos
                        </h4>
                        <p className="text-sm text-white/60 mb-6">
                            Genera un archivo ZIP con toda la información actual de la base de datos.
                        </p>
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isDownloading ? 'Generando...' : 'Descargar ZIP'}
                        </button>
                    </div>
                </div>

                {/* Import Card */}
                <div className="bg-white/5 border border-red-500/20 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Upload className="w-24 h-24 text-red-500" />
                    </div>
                    <div className="relative z-10">
                        <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-red-500" /> Restaurar Sistema
                        </h4>
                        <p className="text-sm text-white/60 mb-6">
                            Sube un archivo ZIP para reemplazar toda la información actual. <span className="text-red-400">Esta acción no se puede deshacer.</span>
                        </p>
                        <input 
                            type="file" 
                            accept=".zip" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRestoring}
                            className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isRestoring ? 'Restaurando...' : 'Subir ZIP'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1a1b26] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-4 mb-4 text-red-500">
                            <div className="p-3 bg-red-500/10 rounded-full">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold">¡ADVERTENCIA!</h3>
                        </div>
                        <p className="text-white/80 mb-6">
                            Estás a punto de restaurar la base de datos desde el archivo <strong className="text-white">{selectedFile?.name}</strong>.
                            <br/><br/>
                            Esta acción <strong>BORRARÁ TODA LA INFORMACIÓN ACTUAL</strong> y la reemplazará con los datos del backup.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRestore}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                            >
                                Sí, Restaurar Sistema
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupSection;
