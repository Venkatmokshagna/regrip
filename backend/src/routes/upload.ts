import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();
router.use(authenticateToken);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// Use memory storage — upload directly from buffer to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: images, PDF, DOCX'));
    }
  },
});

// POST /api/upload
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    const isImage = mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';

    // Wrap Cloudinary stream upload in a Promise
    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'syncdoc',
            resource_type: resourceType,
          },
          (error, result) => {
            if (error || !result) return reject(error);
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          }
        );
        stream.end(fileBuffer);
      }
    );

    return res.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      fileType: mimetype,
      fileName: req.file.originalname,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
