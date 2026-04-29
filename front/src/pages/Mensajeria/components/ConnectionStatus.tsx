import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';

const ConnectionStatus: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const { sessionStatus, phoneNumber } = useSelector((state: RootState) => state.whatsapp);

  const statusConfig: Record<string, { color: string; text: string; pulse: boolean }> = {
    connected: { color: '#25D366', text: phoneNumber ? `Conectado (${phoneNumber})` : 'Conectado', pulse: false },
    qr_pending: { color: '#F59E0B', text: 'Esperando QR', pulse: true },
    reconnecting: { color: '#F59E0B', text: 'Reconectando...', pulse: true },
    disconnected: { color: '#EF4444', text: 'Desconectado', pulse: false },
  };

  const config = statusConfig[sessionStatus] || statusConfig.disconnected;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: config.color }}
        />
        {config.pulse && (
          <div
            className="absolute w-2.5 h-2.5 rounded-full animate-ping"
            style={{ background: config.color, opacity: 0.4 }}
          />
        )}
      </div>
      <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {config.text}
      </span>
    </div>
  );
};

export default ConnectionStatus;
