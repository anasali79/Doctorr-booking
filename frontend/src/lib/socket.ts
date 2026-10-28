import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (token?: string): Socket => {
  if (typeof window === 'undefined') {
    throw new Error('Socket client can only be initialized in the browser');
  }

  let socketUrl = (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001')
  ).trim();

  socketUrl = socketUrl.replace(/\/+$/, '');

  if (socketUrl.endsWith('/api')) {
    socketUrl = socketUrl.slice(0, -4);
  }

  if (!socketInstance) {
    socketInstance = io(`${socketUrl}/appointments`, {
      transports: ['polling', 'websocket'],
      query: token ? { token } : undefined,
      withCredentials: true,
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  } else if (token) {
    socketInstance.auth = { token };
    (socketInstance.io.opts as any).query = { token };
  }

  return socketInstance;
};
