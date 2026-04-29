import { useState, useEffect, useCallback } from 'react';
import { Reminder } from '../types/reminder';
import {
  getReminders,
  addReminder as addReminderStorage,
  updateReminder as updateReminderStorage,
  deleteReminder as deleteReminderStorage,
  getTodayReminders,
  EVENT_NAME,
} from '../services/reminderStorage';

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>(getReminders);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>(getTodayReminders);

  const refresh = useCallback(() => {
    setReminders(getReminders());
    setTodayReminders(getTodayReminders());
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, [refresh]);

  const addReminder = useCallback(
    (reminder: Omit<Reminder, 'id' | 'createdAt' | 'completed'>) => addReminderStorage(reminder),
    [],
  );

  const updateReminder = useCallback(
    (id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => updateReminderStorage(id, updates),
    [],
  );

  const deleteReminder = useCallback(
    (id: string) => deleteReminderStorage(id),
    [],
  );

  const todayCount = todayReminders.filter(r => !r.completed).length;

  return { reminders, todayReminders, todayCount, addReminder, updateReminder, deleteReminder };
}
