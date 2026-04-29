import { Reminder } from '../types/reminder';

const STORAGE_KEY = 'crumi-reminders';
const EVENT_NAME = 'crumi-reminders-changed';

function readAll(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(reminders: Reminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getReminders(): Reminder[] {
  return readAll();
}

export function addReminder(reminder: Omit<Reminder, 'id' | 'createdAt' | 'completed'>): Reminder {
  const all = readAll();
  const newReminder: Reminder = {
    ...reminder,
    id: crypto.randomUUID(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  all.push(newReminder);
  writeAll(all);
  return newReminder;
}

export function updateReminder(id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>): Reminder | null {
  const all = readAll();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  writeAll(all);
  return all[idx];
}

export function deleteReminder(id: string): boolean {
  const all = readAll();
  const filtered = all.filter(r => r.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}

export function getTodayReminders(): Reminder[] {
  const today = new Date().toISOString().slice(0, 10);
  return readAll().filter(r => r.date === today);
}

export function getRemindersForDate(date: string): Reminder[] {
  return readAll().filter(r => r.date === date);
}

export { EVENT_NAME };
