import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import { useReminders } from '../../hooks/useReminders';
import { getRemindersForDate } from '../../services/reminderStorage';
import { Reminder } from '../../types/reminder';
interface CalendarPanelProps {
  darkMode: boolean;
}

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({ darkMode }) => {
  const { reminders, addReminder, updateReminder, deleteReminder } = useReminders();
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');

  const datesWithReminders = useMemo(() => {
    const set = new Set<string>();
    reminders.forEach(r => set.add(r.date));
    return set;
  }, [reminders]);

  const selectedReminders: Reminder[] = useMemo(() => {
    if (!selectedDate) return [];
    return getRemindersForDate(selectedDate);
  }, [selectedDate, reminders]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0
    const totalDays = lastDay.getDate();

    const cells: { day: number; dateStr: string; currentMonth: boolean }[] = [];

    // Previous month padding
    const prevLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = viewMonth - 1;
      const y = m < 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, dateStr: toDateStr(y, (m + 12) % 12, d), currentMonth: false });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ day: d, dateStr: toDateStr(viewYear, viewMonth, d), currentMonth: true });
    }

    // Next month padding
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = viewMonth + 1;
        const y = m > 11 ? viewYear + 1 : viewYear;
        cells.push({ day: d, dateStr: toDateStr(y, m % 12, d), currentMonth: false });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('es', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !selectedDate) return;
    addReminder({ title: newTitle.trim(), date: selectedDate, time: newTime || undefined });
    setNewTitle('');
    setNewTime('');
  };

  const bg = darkMode ? 'bg-crumi-surface-dark border-crumi-border-dark' : 'bg-white border-crumi-border-light';
  const textPrimary = darkMode ? 'text-crumi-text-dark-primary' : 'text-crumi-text-primary';
  const textMuted = darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted';
  const hoverBg = darkMode ? 'hover:bg-crumi-surface-dark-hover' : 'hover:bg-crumi-bg-light';
  const inputBg = darkMode ? 'bg-crumi-bg-dark border-crumi-border-dark text-crumi-text-dark-primary placeholder:text-crumi-text-dark-muted' : 'bg-crumi-bg-light border-crumi-border-light text-crumi-text-primary placeholder:text-crumi-text-muted';

  return (
    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 border rounded-2xl shadow-xl ${bg} w-[340px]`}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={prevMonth} className={`p-1 rounded-lg transition-colors ${hoverBg} ${textMuted}`}>
          <ChevronLeft size={18} />
        </button>
        <span className={`text-sm font-semibold capitalize ${textPrimary}`}>{monthLabel}</span>
        <button onClick={nextMonth} className={`p-1 rounded-lg transition-colors ${hoverBg} ${textMuted}`}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${textMuted}`}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-3 pb-3">
        {calendarDays.map((cell, i) => {
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const hasReminders = datesWithReminders.has(cell.dateStr);

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(cell.dateStr === selectedDate ? null : cell.dateStr)}
              className={`
                relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-all
                ${!cell.currentMonth ? 'opacity-30' : ''}
                ${isSelected ? (darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary') + ' text-white' : isToday ? 'ring-1 ' + (darkMode ? 'ring-crumi-accent' : 'ring-crumi-primary') + ' ' + textPrimary : textPrimary}
                ${!isSelected ? hoverBg : ''}
              `}
            >
              {cell.day}
              {hasReminders && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className={`border-t px-4 py-3 ${darkMode ? 'border-crumi-border-dark' : 'border-crumi-border-light'}`}>
          <p className={`text-xs font-semibold mb-2 ${textMuted}`}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {/* Reminder list */}
          {selectedReminders.length > 0 ? (
            <ul className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
              {selectedReminders.map(r => (
                <li key={r.id} className={`flex items-center gap-2 text-sm ${textPrimary}`}>
                  <input
                    type="checkbox"
                    checked={r.completed}
                    onChange={() => updateReminder(r.id, { completed: !r.completed })}
                    className="accent-crumi-primary shrink-0"
                  />
                  <span className={`flex-1 truncate ${r.completed ? 'line-through opacity-50' : ''}`}>
                    {r.time && <span className={`${textMuted} mr-1`}>{r.time}</span>}
                    {r.title}
                  </span>
                  <button onClick={() => deleteReminder(r.id)} className={`p-0.5 rounded transition-colors ${hoverBg} ${textMuted}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-xs mb-3 ${textMuted}`}>Sin recordatorios</p>
          )}

          {/* Add form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nuevo recordatorio..."
              className={`flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border outline-none ${inputBg}`}
            />
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className={`w-[90px] px-2 py-1.5 text-sm rounded-lg border outline-none ${inputBg}`}
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className={`p-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity ${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPanel;
