import React from 'react';

const platforms = [
  { id: 'whatsapp', label: 'WhatsApp', active: true, color: '#25D366' },
  { id: 'telegram', label: 'Telegram', active: false, color: '#0088cc' },
  { id: 'facebook', label: 'Facebook', active: false, color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', active: false, color: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', active: false, color: '#000000' },
];

interface PlatformTabsProps {
  activePlatform: string;
  onSelect: (id: string) => void;
  darkMode: boolean;
}

const PlatformTabs: React.FC<PlatformTabsProps> = ({ activePlatform, onSelect, darkMode }) => {
  return (
    <div className="flex gap-1 p-1 rounded-2xl" style={{ background: darkMode ? '#111315' : '#F3F5F7' }}>
      {platforms.map(p => (
        <button
          key={p.id}
          onClick={() => p.active && onSelect(p.id)}
          disabled={!p.active}
          className={`
            px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
            ${activePlatform === p.id
              ? 'text-white shadow-sm'
              : p.active
                ? darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
                : 'text-gray-400 opacity-50 cursor-not-allowed'
            }
          `}
          style={activePlatform === p.id ? { background: p.color } : undefined}
        >
          {p.label}
          {!p.active && <span className="ml-1 text-[10px] opacity-60">pronto</span>}
        </button>
      ))}
    </div>
  );
};

export default PlatformTabs;
