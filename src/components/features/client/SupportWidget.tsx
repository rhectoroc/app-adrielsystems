
import { MessageCircle, Mail } from 'lucide-react';

export const SupportWidget = () => {
    return (
        <div className="p-6 text-white rounded-xl shadow-lg bg-gradient-to-br from-primary/80 to-blue-900/80 border border-primary/20 backdrop-blur-md">
            <h2 className="mb-2 text-xl font-bold font-heading">¿Necesitas Ayuda?</h2>
            <p className="mb-6 text-blue-100">
                Contacta directamente a nuestro equipo de soporte. Estamos disponibles Lun-Vie, 9am - 5pm.
            </p>
            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
                <a
                    href="https://wa.me/1234567890"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-2 font-semibold text-green-700 transition-colors bg-white rounded-lg hover:bg-green-50 shadow-md"
                >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Soporte WhatsApp
                </a>
                <a
                    href="mailto:support@adrielssystems.com"
                    className="flex items-center justify-center px-4 py-2 font-semibold text-primary transition-colors bg-white rounded-lg hover:bg-blue-50 shadow-md"
                >
                    <Mail className="w-5 h-5 mr-2" />
                    Ticket por Correo
                </a>
            </div>
        </div >
    );
};
