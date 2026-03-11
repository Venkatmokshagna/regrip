import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../db';
import { Role } from '@prisma/client';

export const requireRole = (allowedRoles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const documentId = req.params.id;

      if (!userId || !documentId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (doc.ownerId === userId) {
        // Owners always have full access
        return next();
      }

      const userRole = await prisma.userDocumentRole.findUnique({
        where: {
          userId_documentId: {
            userId,
            documentId,
          },
        },
      });

      if (!userRole || !allowedRoles.includes(userRole.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }

      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
