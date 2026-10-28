'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { formatTime, formatDate } from '@/lib/utils';
import { clientAxios } from '@/lib/api/axios';

interface UseSocketOptions {
  role: 'doctor' | 'patient';
  profileId?: string; // doctorId or patientId
  initialToken?: string;
  onEvent?: (event: string, data: any) => void;
}

export function useAppointmentSocket({ role, profileId, initialToken, onEvent }: UseSocketOptions) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!profileId) return;

    let socket: ReturnType<typeof getSocket> | null = null;
    let isCancelled = false;

    async function initSocket() {
      try {
        let token = initialToken || '';

        if (!token) {
          try {
            const res = await clientAxios.get<{ token: string }>('/api/auth/token');
            token = res.data?.token || '';
          } catch {
            token = '';
          }
        }

        if (!token && typeof document !== 'undefined') {
          const match = document.cookie.match(/(?:^|;\s*)(?:token|jwt|access_token)=([^;]+)/);
          if (match) token = match[1];
        }

        if (isCancelled || !token) return;

        socket = getSocket(token);

        const roomName = role === 'doctor' ? `doctor:${profileId}` : `patient:${profileId}`;

        function handleConnect() {
          setIsConnected(true);
          socket?.emit('join_room', { room: roomName }, (ack: any) => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Socket] Joined room ${roomName}`, ack);
            }
          });
        }

        function handleDisconnect() {
          setIsConnected(false);
        }

        function handleConnectError(err: any) {
          setIsConnected(false);
        }

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        // Doctor events
        if (role === 'doctor') {
          socket.on('appointment.booked', (data: any) => {
            const time = data.startTime ? formatTime(data.startTime) : '';
            const patient = data.patientName || 'A patient';
            toast.success(`New Appointment Booked!`, {
              description: `${patient} booked a slot at ${time}`,
              duration: 5000,
            });
            onEventRef.current?.('appointment.booked', data);
            router.refresh();
          });

          socket.on('appointment.rescheduled', (data: any) => {
            const time = data.startTime ? formatTime(data.startTime) : '';
            toast.info(`Appointment Rescheduled`, {
              description: `Appointment moved to ${formatDate(data.date)} at ${time}`,
            });
            onEventRef.current?.('appointment.rescheduled', data);
            router.refresh();
          });

          socket.on('appointment.cancelled', (data: any) => {
            toast.warning(`Appointment Cancelled`, {
              description: `A patient has cancelled their slot.`,
            });
            onEventRef.current?.('appointment.cancelled', data);
            router.refresh();
          });

          socket.on('queue.updated', (data: any) => {
            onEventRef.current?.('queue.updated', data);
            router.refresh();
          });
        }

        // Patient events
        if (role === 'patient') {
          const notifyQueueUpdate = (name: string, payload: any) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('appointment_queue_update', { detail: { event: name, payload } }));
            }
          };

          socket.on('appointment.checked_in', (data: any) => {
            toast.info(`Checked In to Clinic`, {
              description: `You are checked in. Queue position: #${data.queuePosition || 1}`,
            });
            onEventRef.current?.('appointment.checked_in', data);
            notifyQueueUpdate('appointment.checked_in', data);
            router.refresh();
          });

          socket.on('appointment.consultation_started', (data: any) => {
            toast.success(`Your Turn! Consultation Started`, {
              description: `Doctor is ready for you. Please proceed to the cabin.`,
              duration: 8000,
            });
            onEventRef.current?.('appointment.consultation_started', data);
            notifyQueueUpdate('appointment.consultation_started', data);
            router.refresh();
          });

          socket.on('appointment.completed', (data: any) => {
            toast.success(`Consultation Completed`, {
              description: `Your consultation has concluded. Have a healthy day!`,
            });
            onEventRef.current?.('appointment.completed', data);
            notifyQueueUpdate('appointment.completed', data);
            router.refresh();
          });

          socket.on('appointment.cancelled', (data: any) => {
            toast.error(`Appointment Cancelled`, {
              description: `Your appointment was cancelled.`,
            });
            onEventRef.current?.('appointment.cancelled', data);
            notifyQueueUpdate('appointment.cancelled', data);
            router.refresh();
          });

          socket.on('appointment.no_show', (data: any) => {
            toast.warning(`Marked as No Show`, {
              description: `You were marked as no-show for your appointment.`,
            });
            onEventRef.current?.('appointment.no_show', data);
            notifyQueueUpdate('appointment.no_show', data);
            router.refresh();
          });

          socket.on('queue.position.updated', (data: any) => {
            toast.info(`Queue Progress`, {
              description: `Your queue position is now #${data.queuePosition}`,
            });
            onEventRef.current?.('queue.position.updated', data);
            notifyQueueUpdate('queue.position.updated', data);
            router.refresh();
          });
        }

        if (!socket.connected) {
          socket.connect();
        } else {
          handleConnect();
        }
      } catch (err) {
        console.error('Socket init error:', err);
      }
    }

    initSocket();

    return () => {
      isCancelled = true;
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('appointment.booked');
        socket.off('appointment.rescheduled');
        socket.off('appointment.cancelled');
        socket.off('queue.updated');
        socket.off('appointment.checked_in');
        socket.off('appointment.consultation_started');
        socket.off('appointment.completed');
        socket.off('appointment.no_show');
        socket.off('queue.position.updated');
      }
    };
  }, [role, profileId, router]);

  return { isConnected };
}
