import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useReminders } from '../../hooks/useReminders';

interface AlarmBellDropdownProps {
  darkMode: boolean;
}

const AlarmBellDropdown: React.FC<AlarmBellDropdownProps> = ({ darkMode }) => {
  const { todayReminders, todayCount, updateReminder } = useReminders();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const textPrimary = darkMode ? 'text-crumi-text-dark-primary' : 'text-crumi-text-primary';
  const textMuted = darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted';
  const bg = darkMode ? 'bg-crumi-surface-dark border-crumi-border-dark' : 'bg-white border-crumi-border-light';
  const hoverBg = darkMode ? 'hover:bg-crumi-surface-dark-hover' : 'hover:bg-crumi-bg-light';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2.5 rounded-xl transition-colors
          ${darkMode ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted' : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
        `}
        title="Recordatorios de hoy"
      >
        <Bell size={18} />
        {todayCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
            {todayCount > 9 ? '9+' : todayCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-72 border rounded-2xl shadow-xl z-50 ${bg}`}>
          <div className={`px-4 pt-3 pb-2 border-b ${darkMode ? 'border-crumi-border-dark' : 'border-crumi-border-light'}`}>
            <p className={`text-sm font-semibold ${textPrimary}`}>Recordatorios de hoy</p>
          </div>

          <div className="px-4 py-3 max-h-60 overflow-y-auto">
            {todayReminders.length === 0 ? (
              <p className={`text-sm ${textMuted}`}>No hay recordatorios para hoy</p>
            ) : (
              <ul className="space-y-2">
                {todayReminders.map(r => (
                  <li key={r.id} className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 transition-colors ${hoverBg}`}>
                    <input
                      type="checkbox"
                      checked={r.completed}
                      onChange={() => updateReminder(r.id, { completed: !r.completed })}
                      className="accent-crumi-primary shrink-0"
                    />
                    <span className={`flex-1 truncate ${r.completed ? 'line-through opacity-50' : ''} ${textPrimary}`}>
                      {r.time && <span className={`${textMuted} mr-1`}>{r.time}</span>}
                      {r.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlarmBellDropdown;
