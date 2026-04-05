import { useState, useEffect } from 'react';
import { 
    X, 
    MessageSquare, 
    Zap, 
    ChevronRight, 
    Loader2, 
    Copy, 
    AlertCircle,
    TestTube2
} from 'lucide-react';
import { api } from '../../../utils/api';
import { toast } from 'sonner';

interface Client {
    id: number;
    name: string;
    phone: string;
    email: string;
    total_debt: string | number;
    status: string;
}

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'SINGLE' | 'BULK' | 'TEST';
    clients: Client[];
    onSuccess: () => void;
}

const TEMPLATES = [
    {
        id: 'DEBT_REMINDER',
        name: 'Recordatorio de Cobro (Monto)',
        icon: <AlertCircle className="w-4 h-4 text-red-400" />,
        content: "Hola {{nombre}}, espero estés muy bien. Te contactamos de Adriel's Systems para recordarte que tienes un saldo pendiente de ${{monto}}. Agradecemos tu pronto pago para mantener la continuidad del servicio. ¡Saludos!"
    },
    {
        id: 'PROMO',
        name: 'Oferta Promocional',
        icon: <Zap className="w-4 h-4 text-yellow-400" />,
        content: "¡Hola {{nombre}}! 🎉 Tenemos una oferta especial de temporada para nuestros servicios en Adriel's Systems que no querrás perderte. Contáctanos para más detalles."
    },
    {
        id: 'TEST',
        name: 'Prueba de Sistema',
        icon: <TestTube2 className="w-4 h-4 text-blue-400" />,
        content: "PRUEBA DE SISTEMA: Hola {{nombre}}, este es un mensaje de prueba generado desde el panel de control de Adriel's Systems."
    }
];

export const MessageModal = ({ isOpen, onClose, mode, clients, onSuccess }: MessageModalProps) => {
    const [selectedTemplate, setSelectedTemplate] = useState(mode === 'TEST' ? TEMPLATES[2] : TEMPLATES[0]);
    const [messageText, setMessageText] = useState(selectedTemplate.content);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0); // For bulk sequence

    useEffect(() => {
        if (mode === 'TEST') {
            setSelectedTemplate(TEMPLATES[2]);
            setMessageText(TEMPLATES[2].content);
        }
    }, [mode]);

    const replacePlaceholders = (text: string, client: Client) => {
        let result = text;
        result = result.replace(/{{nombre}}/g, client.name);
        result = result.replace(/{{monto}}/g, parseFloat(client.total_debt.toString()).toLocaleString());
        return result;
    };

    const handleTemplateChange = (template: typeof TEMPLATES[0]) => {
        setSelectedTemplate(template);
        setMessageText(template.content);
    };

    const currentClient = clients[currentIndex] || clients[0];
    const previewMessage = replacePlaceholders(messageText, currentClient);

    const logAndSend = async (client: Client, finalMessage: string) => {
        setIsSubmitting(true);
        try {
            // 1. Log to DB
            const response = await api.post('/api/notifications/log', {
                client_id: client.id,
                type: selectedTemplate.id.toLowerCase(),
                channel: 'whatsapp',
                status: 'SENT',
                message_body: finalMessage
            });

            if (!response.ok) throw new Error('Failed to log notification');

            // 2. Send via Backend (which calls Evolution API)
            if (client.phone) {
                const sendRes = await api.post('/api/messages/send', {
                    phone: client.phone,
                    message: finalMessage
                });
                
                if (!sendRes.ok) {
                    const errorData = await sendRes.json();
                    throw new Error(errorData.message || 'Error al enviar por WhatsApp');
                }
            } else {
                toast.warning(`El cliente ${client.name} no tiene teléfono configurado.`);
                setIsSubmitting(false);
                return;
            }

            if (mode === 'SINGLE' || mode === 'TEST') {
                toast.success('Envío procesado y registrado');
                onSuccess();
                onClose();
            } else {
                // Bulk mode: move to next
                if (currentIndex < clients.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                    toast.success(`Registrado ${client.name}. Pasando al siguiente (${currentIndex + 2}/${clients.length})`);
                } else {
                    toast.success('Envío masivo finalizado');
                    onSuccess();
                    onClose();
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Error al registrar el envío');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(previewMessage);
        toast.success('Copiado al portapapeles');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">
                                {mode === 'TEST' ? 'Modo Prueba' : mode === 'BULK' ? 'Envío Masivo' : 'Mensaje Personalizado'}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                {mode === 'BULK' ? `Cliente ${currentIndex + 1} de ${clients.length}` : `Para: ${currentClient.name}`}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                    {/* Template Selector */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Seleccionar Plantilla</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {TEMPLATES.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => handleTemplateChange(tmpl)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                        selectedTemplate.id === tmpl.id 
                                        ? 'bg-primary/10 border-primary text-white shadow-[0_0_15px_-5px_rgba(var(--primary-rgb),.3)]' 
                                        : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/20'
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-lg ${selectedTemplate.id === tmpl.id ? 'bg-primary/20' : 'bg-white/5'}`}>
                                        {tmpl.icon}
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-tighter leading-tight">{tmpl.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Message Editor */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Personalizar Contenido</label>
                            <span className="text-[9px] text-gray-600 font-bold uppercase">Usa {'{{nombre}}'} o {'{{monto}}'}</span>
                        </div>
                        <textarea 
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-primary/50 min-h-[120px] custom-scrollbar"
                            placeholder="Escribe tu mensaje aquí..."
                        />
                    </div>

                    {/* Preview Area */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1">Previsualización (WhatsApp)</label>
                            {currentClient.phone && <span className="text-[9px] text-green-500 font-black uppercase">Tel: {currentClient.phone}</span>}
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 relative group">
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap italic">
                                "{previewMessage}"
                            </p>
                            <button 
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                                title="Copiar al portapapeles"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">
                        {mode === 'BULK' ? `${currentIndex + 1} de ${clients.length} completados` : 'Registro automático activado'}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => logAndSend(currentClient, previewMessage)}
                            disabled={isSubmitting || !currentClient}
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-black px-6 py-2 rounded-xl transition-all text-xs font-black uppercase tracking-[0.1em] shadow-[0_4px_15px_-5px_rgba(var(--primary-rgb),.5)] disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>{mode === 'BULK' ? 'Siguiente Envío' : 'Enviar y Registrar'}</span>
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
