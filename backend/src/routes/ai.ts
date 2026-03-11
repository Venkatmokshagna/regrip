import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router({ mergeParams: true });
router.use(authenticateToken);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.post('/', requireRole(['EDITOR', 'OWNER']), async (req: AuthRequest, res: Response) => {
  try {
    const { action, text } = req.body;
    if (!text || !action) {
      return res.status(400).json({ error: 'Text and action are required' });
    }

    let prompt = '';
    if (action === 'summarize') {
      prompt = `Summarize the following document content concisely:\n\n${text}`;
    } else if (action === 'grammar') {
      prompt = `Fix the grammar, spelling, and tone of the following text, providing only the corrected text:\n\n${text}`;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    /// set up stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (apiError: any) {
      console.error('Gemini API Error:', apiError);
      res.write(`data: {"error": "Failed to generate AI content"}\n\n`);
      res.end();
    }

  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

export default router;
