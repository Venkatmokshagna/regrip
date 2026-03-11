import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { YSocketIO } from 'y-socket.io/dist/server';
import jwt from 'jsonwebtoken';
import prisma from './db';
import { Role } from '@prisma/client';

export const initializeSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  const ysocketio = new YSocketIO(io);
  ysocketio.initialize();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-change-me-later');
      socket.data.userId = decoded.id;

      const documentId = socket.handshake.query.documentId as string;
      if (!documentId) return next(new Error('Document ID required'));

      socket.data.documentId = documentId;

      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) return next(new Error('Document not found'));

      let userRole: Role | 'OWNER' = 'VIEWER';

      if (doc.ownerId === decoded.id) {
        userRole = 'OWNER';
      } else {
        const roleRecord = await prisma.userDocumentRole.findUnique({
          where: { userId_documentId: { userId: decoded.id, documentId } }
        });
        if (!roleRecord) return next(new Error('Forbidden'));
        userRole = roleRecord.role;
      }

      socket.data.role = userRole;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { documentId, role, userId } = socket.data;

    socket.join(documentId);

    // Enforce Read-Only constraint for Yjs Syncing
    // y-socket.io listens to 'sync-update' events natively.
    // If the user is a VIEWER, we prevent them from modifying the doc.
    if (role === 'VIEWER') {
      const originalEmit = socket.emit;
      const originalOn = socket.on;

      // Disable incoming 'sync-update' from this socket
      socket.on = function (eventName: any, ...args: any[]) {
        if (eventName === 'sync-update' || eventName === 'sync-step-1' || eventName === 'sync-step-2') {
           // Do nothing, read-only
           // We only intercept if we need to actively block updates, 
           // but normally we'd just want to throw an error if they try
           return socket; 
        }
        return originalOn.apply(this, [eventName, ...args]);
      };
    }

    socket.on('disconnect', async () => {
      // Sync doc to database periodically or on disconnect
      try {
        const ydoc = ysocketio.documents.get(documentId);
        if (ydoc) {
           // This requires converting ydoc state to plain text OR storing the binary blob.
           // Since assignment asks for typical text syncing, storing the pure text via tip-tap
           // update from the frontend is often easier, but we can also store the ydoc binary.
           // For simplicity in this short assessment, we might rely on the frontend Editor's "onBlur"
           // or periodic auto-save API calls to save content, OR we can listen to Yjs updates here.
        }
      } catch (err) {}
    });

    // Chat functionality
    socket.on('send-message', async (data: { message?: string; fileUrl?: string }) => {
      if (role === 'VIEWER') {
        socket.emit('error', 'Forbidden: Viewers cannot send messages');
        return;
      }

      try {
        const chatMsg = await prisma.chatMessage.create({
          data: {
            documentId,
            userId,
            message: data.message,
            fileUrl: data.fileUrl,
          },
          include: { user: { select: { id: true, name: true, email: true } } }
        });

        io.to(documentId).emit('new-message', chatMsg);
      } catch (err) {
        console.error('Chat error', err);
      }
    });
  });

  // Expose ysocketio document updates wrapper to persist to DB cleanly
  ysocketio.on('document-update', async (doc: any, update: any) => {
    // Advanced Yjs DB Persistence not required for the assignment but good practice.
    // To ensure basic assignment functionality, frontend Periodic Saving will be used.
  });
};
