export interface Reminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  completed: boolean;
  createdAt: string;
}
