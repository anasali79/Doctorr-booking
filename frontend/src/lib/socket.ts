import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (token?: string): Socket => {
  if (typeof window === 'undefined') {
    throw new Error('Socket client can only be initialized in the browser');
  }

  let socketUrl = (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://schedula-backend-j9k6.onrender.com'
  ).trim().replace(/\/+$/, '');

  if (socketUrl.endsWith('/api')) {
    socketUrl = socketUrl.slice(0, -4);
  }

  if (!socketInstance) {
    socketInstance = io(`${socketUrl}/appointments`, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (token && socketInstance.auth) {
    (socketInstance.auth as any).token = token;
  }

  return socketInstance;
};
