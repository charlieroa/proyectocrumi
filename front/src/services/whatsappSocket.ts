/**
 * WhatsApp Socket.IO client - Connects to backend /whatsapp namespace
 */

import { io, Socket } from 'socket.io-client';
import { env } from '../env';
import { getToken } from './auth';
import store from '../store';
import {
  setQrCode,
  setSessionStatus,
  addMessage,
  updateMessageStatus,
} from '../slices/whatsapp/whatsappSlice';

let socket: Socket | null = null;

// Derive the Socket.IO URL from the API URL (strip /api suffix)
const getSocketUrl = () => {
  const apiUrl = env.API_URL || 'http://localhost:3002/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

export const connectWhatsAppSocket = (tenantId: number) => {
  if (socket?.connected) return;

  const baseUrl = getSocketUrl();

  socket = io(`${baseUrl}/whatsapp`, {
    auth: { token: getToken() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[WA Socket] Connected');
    socket?.emit('join_tenant', tenantId);
  });

  socket.on('qr', (data: { qr: string }) => {
    store.dispatch(setQrCode(data.qr));
  });

  socket.on('connection_status', (data: { status: string; phoneNumber?: string }) => {
    store.dispatch(setSessionStatus({
      status: data.status as any,
      phoneNumber: data.phoneNumber,
    }));
  });

  socket.on('new_message', (data: { message: any; conversation: any; contact?: any }) => {
    store.dispatch(addMessage({
      message: data.message,
      conversation: data.conversation,
    }));

    // Play notification sound for inbound messages
    if (data.message.direction === 'inbound') {
      playNotificationSound();
    }
  });

  socket.on('message_status_update', (data: { waMessageId: string; status: string }) => {
    store.dispatch(updateMessageStatus(data));
  });

  socket.on('disconnect', () => {
    console.log('[WA Socket] Disconnected');
  });

  socket.on('connect_error', (err: Error) => {
    console.error('[WA Socket] Connection error:', err.message);
  });
};

export const disconnectWhatsAppSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch {
    // Ignore audio errors
  }
};

export default socket;
