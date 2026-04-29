// front/src/services/taskService.ts
// Servicio para interactuar con la API de tareas

import api from './api';

export interface Assignee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  tenant_name?: string;
}

export interface ChecklistItem {
  id?: string;
  text: string;
  completed: boolean;
  sort_order?: number;
}

export interface Task {
  id: string;
  tenant_id: string;
  assigned_to?: string;
  assignees?: Assignee[];
  checklist?: ChecklistItem[];
  assigned_to_name?: string;
  assigned_to_email?: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  created_at: string;
  updated_at?: string;
  tenant_name?: string;
}

export interface CreateTaskData {
  assignees?: string[];
  assigned_to?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  status?: 'pending' | 'in_progress' | 'done';
  task_tenant_id?: string;
  checklist?: { text: string; completed: boolean }[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  assignees?: string[];
  checklist?: { text: string; completed: boolean }[];
}

export interface UserForAssignment {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
  tenant_name?: string;
  tenant_id?: string;
}

// Obtener todas las tareas
export const getTasks = async (assigned_to?: string): Promise<Task[]> => {
  try {
    const params = assigned_to ? { assigned_to } : {};
    const response = await api.get('/tasks', { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

// Crear una nueva tarea
export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  try {
    const response = await api.post('/tasks', taskData);
    return response.data;
  } catch (error: any) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// Actualizar una tarea
export const updateTask = async (taskId: string, taskData: UpdateTaskData): Promise<Task> => {
  try {
    const response = await api.put(`/tasks/${taskId}`, taskData);
    return response.data;
  } catch (error: any) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Eliminar una tarea
export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    await api.delete(`/tasks/${taskId}`);
  } catch (error: any) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Obtener usuarios para asignar tareas
export const getUsersForAssignment = async (): Promise<UserForAssignment[]> => {
  try {
    const response = await api.get('/tasks/users');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching users for assignment:', error);
    throw error;
  }
};

// ============ CHECKLIST ============

// Agregar item al checklist
export const addChecklistItem = async (taskId: string, text: string): Promise<ChecklistItem> => {
  const response = await api.post(`/tasks/${taskId}/checklist`, { text });
  return response.data;
};

// Toggle item completado
export const toggleChecklistItem = async (itemId: string): Promise<ChecklistItem> => {
  const response = await api.patch(`/tasks/checklist/${itemId}/toggle`);
  return response.data;
};

// Eliminar item del checklist
export const deleteChecklistItem = async (itemId: string): Promise<void> => {
  await api.delete(`/tasks/checklist/${itemId}`);
};
