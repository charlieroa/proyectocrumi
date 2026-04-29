import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import * as waApi from '../../../services/whatsappApi';

interface QrCodeConnectProps {
  darkMode: boolean;
}

const QrCodeConnect: React.FC<QrCodeConnectProps> = ({ darkMode }) => {
  const { qrCode, sessionStatus } = useSelector((state: RootState) => state.whatsapp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      await waApi.startSession();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className={`max-w-md w-full p-8 rounded-3xl text-center ${darkMode ? 'bg-[#1A1D1F]' : 'bg-white'} shadow-lg`}>
        {/* WhatsApp icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: '#25D366' }}>
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>

        <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Conectar WhatsApp
        </h2>
        <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Vincula tu WhatsApp para recibir y responder mensajes desde Bolti
        </p>

        {sessionStatus === 'qr_pending' && qrCode ? (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl inline-block">
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            </div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Abre WhatsApp en tu telefono &gt; Dispositivos vinculados &gt; Vincular dispositivo
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3 px-6 rounded-2xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
              style={{ background: '#25D366' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Conectando...
                </span>
              ) : 'Generar codigo QR'}
            </button>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className={`text-xs space-y-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <p>1. Haz clic en "Generar codigo QR"</p>
              <p>2. Escanea el codigo con WhatsApp</p>
              <p>3. Listo, los mensajes aparecen aqui</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrCodeConnect;
