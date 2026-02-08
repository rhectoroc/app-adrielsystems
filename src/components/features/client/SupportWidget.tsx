
import { MessageCircle, Mail } from 'lucide-react';

export const SupportWidget = () => {
    return (
        <div className="p-6 text-white rounded-lg shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700">
            <h2 className="mb-2 text-xl font-bold">Need Help?</h2>
            <p className="mb-6 text-blue-100">
                Contact our support team directly. We are available Mon-Fri, 9am - 5pm.
            </p>
            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
                <a
                    href="https://wa.me/1234567890"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-2 font-semibold text-green-600 transition-colors bg-white rounded-lg hover:bg-green-50"
                >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    WhatsApp Support
                </a>
                <a
                    href="mailto:support@adrielssystems.com"
                    className="flex items-center justify-center px-4 py-2 font-semibold text-blue-700 transition-colors bg-white rounded-lg hover:bg-blue-50"
                >
                    <Mail className="w-5 h-5 mr-2" />
                    Email Ticket
                </a>
            </div>
        </div>
    );
};
