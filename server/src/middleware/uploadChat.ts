import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { uploadDir } from './upload'

export const chatUploadDir = path.join(uploadDir, 'chat')
if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
    cb(null, `${crypto.randomUUID()}_${safe}${ext}`)
  },
})

// Accept all; per-type size limits enforced via magic-byte check after upload
export const chatUpload = multer({
  storage,
  limits: { fileSize: 262_144_000 }, // 250 MB max (largest allowed: video)
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime',
      'application/pdf',
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Ungültiger Dateityp'))
  },
})

export const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 20_971_520,
  'image/png': 20_971_520,
  'image/gif': 20_971_520,
  'image/webp': 20_971_520,
  'video/mp4': 262_144_000,
  'video/quicktime': 262_144_000,
  'application/pdf': 26_214_400,
}
