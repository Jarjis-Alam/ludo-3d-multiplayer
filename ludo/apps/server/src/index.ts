import express, { type Express } from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createPersistence } from './persistence.js';
import { LudoService } from './game-server.js';

export function parseOrigin(raw?: string): string | string[] {
  if (!raw) return 'http://localhost:5173';
  if (raw === '*') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Insecure configuration: CLIENT_ORIGIN="*" is prohibited in production. ' +
        'Set CLIENT_ORIGIN to your exact frontend origin (e.g. CLIENT_ORIGIN=https://your-app.vercel.app).'
      );
    }
    return '*';
  }
  if (raw.includes(',')) {
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return raw;
}

export type LudoServer = { app: Express; httpServer: ReturnType<typeof createServer>; io: Server; service: LudoService };

export async function createLudoServer(persistence = createPersistence()): Promise<LudoServer> {
  const app = express();
  const rawOrigin = process.env.CLIENT_ORIGIN;
  const origin = parseOrigin(rawOrigin);
  const invitationOrigin =
    typeof origin === 'string' && origin !== '*'
      ? origin
      : Array.isArray(origin)
      ? origin[0]
      : 'http://localhost:5173';

  app.use(cors({ origin, credentials: true }));
  app.get('/health', (_req, res) =>
    res.json({
      ok: true,
      service: 'ludo-server',
      persistence: process.env.DATABASE_URL ? 'postgres' : 'memory-local',
    })
  );

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin, credentials: true },
    transports: ['websocket', 'polling'],
  });
  const service = new LudoService(persistence, invitationOrigin);
  await service.init();
  service.bind(io);
  return { app, httpServer, io, service };
}

const isDirectRun =
  process.argv[1]?.endsWith('/src/index.ts') ||
  process.argv[1]?.endsWith('/dist/index.js') ||
  process.argv[1]?.endsWith('/src/index.js');

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3001);
  createLudoServer().then(({ httpServer }) =>
    httpServer.listen(port, '0.0.0.0', () => console.log(`Ludo server listening on ${port}`))
  );
}
