import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut, Users } from 'lucide-react';
import type { RootState } from '../../store';
import { getTenantIdFromToken } from '../../services/auth';
import { connectWhatsAppSocket, disconnectWhatsAppSocket } from '../../services/whatsappSocket';
import { setSessionStatus } from '../../slices/whatsapp/whatsappSlice';
import * as waApi from '../../services/whatsappApi';
import PlatformTabs from './components/PlatformTabs';
import ConnectionStatus from './components/ConnectionStatus';
import QrCodeConnect from './components/QrCodeConnect';
import ConversationList from './components/ConversationList';
import ConversationThread from './components/ConversationThread';
import ConversationInfo from './components/ConversationInfo';
import GroupList from './components/GroupList';

const MensajeriaPage: React.FC = () => {
  const dispatch = useDispatch();
  const [darkMode] = useState(() => localStorage.getItem('crumi-dark-mode') === 'true');
  const { sessionStatus } = useSelector((state: RootState) => state.whatsapp);
  const [activePlatform, setActivePlatform] = useState('whatsapp');
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const [showInfo, setShowInfo] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Connect socket and check session status on mount
  useEffect(() => {
    const tenantId = getTenantIdFromToken();
    if (tenantId) {
      connectWhatsAppSocket(Number(tenantId));
      checkStatus();
    }
    return () => {
      disconnectWhatsAppSocket();
    };
  }, []);

  const checkStatus = async () => {
    try {
      const res = await waApi.getSessionStatus();
      dispatch(setSessionStatus({
        status: res.data.status,
        phoneNumber: res.data.phoneNumber,
      }));
    } catch (err) {
      // Not connected
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await waApi.logoutSession();
      dispatch(setSessionStatus({ status: 'disconnected' }));
    } catch (err) {
      console.error('[Mensajeria] Error disconnecting:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = sessionStatus === 'connected';

  return (
    <div className={`flex flex-col h-full ${darkMode ? 'bg-[#0D0F10]' : 'bg-gray-50/30'}`}>
      {/* Top bar */}
      <div className={`shrink-0 flex items-center justify-between px-4 py-2.5 border-b ${darkMode ? 'border-[#2A2D30] bg-[#111315]' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-base font-bold m-0 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Mensajeria
          </h1>
          <PlatformTabs activePlatform={activePlatform} onSelect={setActivePlatform} darkMode={darkMode} />
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus darkMode={darkMode} />
          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}
                disabled:opacity-50
              `}
            >
              <LogOut size={14} />
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      {!isConnected && sessionStatus !== 'qr_pending' ? (
        <QrCodeConnect darkMode={darkMode} />
      ) : sessionStatus === 'qr_pending' ? (
        <QrCodeConnect darkMode={darkMode} />
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left panel: Conversations / Groups */}
          <div className={`w-80 shrink-0 flex flex-col border-r ${darkMode ? 'border-[#2A2D30]' : 'border-gray-100'}`}>
            {/* Tabs */}
            <div className={`flex shrink-0 border-b ${darkMode ? 'border-[#2A2D30]' : 'border-gray-100'}`}>
              <button
                onClick={() => setActiveTab('chats')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors
                  ${activeTab === 'chats'
                    ? darkMode ? 'text-white border-b-2 border-crumi-primary' : 'text-crumi-primary border-b-2 border-crumi-primary'
                    : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                  ${activeTab === 'groups'
                    ? darkMode ? 'text-white border-b-2 border-crumi-primary' : 'text-crumi-primary border-b-2 border-crumi-primary'
                    : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                <Users size={14} />
                Grupos
              </button>
            </div>

            {/* Content */}
            {activeTab === 'chats' ? (
              <ConversationList darkMode={darkMode} />
            ) : (
              <GroupList darkMode={darkMode} />
            )}
          </div>

          {/* Center: Message thread */}
          <ConversationThread darkMode={darkMode} />

          {/* Right panel: Contact info (toggle) */}
          {showInfo && <ConversationInfo darkMode={darkMode} onClose={() => setShowInfo(false)} />}
        </div>
      )}
    </div>
  );
};

export default MensajeriaPage;
