import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import prisma from '../db';

const router = Router();
router.use(authenticateToken); // Protect all document routes

// List all documents (Owned + Shared)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    
    // docs where user is owner, or has a role
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { roles: { some: { userId } } },
        ]
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { title } = req.body;

    const doc = await prisma.document.create({
      data: {
        title: title || 'Untitled',
        content: '',
        ownerId: userId,
      }
    });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single document
router.get('/:id', requireRole(['EDITOR', 'VIEWER']), async (req: AuthRequest, res: Response) => {
  // if `requireRole` reached here, the user is an owner, editor, or viewer.
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        roles: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update title
router.put('/:id', requireRole(['EDITOR']), async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: { title }
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete document (Only owner)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.ownerId !== req.user?.id) {
      return res.status(403).json({ error: 'Only owner can delete' });
    }
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Share Document
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const { email, role } = req.body; // role: 'EDITOR' | 'VIEWER'
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    
    if (!doc || doc.ownerId !== req.user?.id) {
      // For assignment, assuming only owner can share (could modify to Editors too)
      return res.status(403).json({ error: 'Only owner can share' });
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.id === req.user?.id) return res.status(400).json({ error: 'Cannot share with yourself' });

    // Upsert the role
    const newRole = await prisma.userDocumentRole.upsert({
      where: {
        userId_documentId: {
          userId: targetUser.id,
          documentId: req.params.id
        }
      },
      update: { role },
      create: {
        userId: targetUser.id,
        documentId: req.params.id,
        role
      }
    });

    res.json(newRole);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
