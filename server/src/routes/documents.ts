import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { upload } from '../middleware/upload'
import { ok, err } from '../types'
import type { Document } from '../types'

export const documentsRouter = Router()

const VALID_CATEGORIES = ['anmeldeformular', 'vereinsdokument', 'sonstiges'] as const

documentsRouter.get('/', requireAuth(), async (req, res) => {
  try {
    const category = req.query.category as string | undefined
    let query = `SELECT id, name, category, filename, size_bytes, uploaded_by, created_at
                 FROM documents ORDER BY created_at DESC`
    const values: string[] = []
    if (category && VALID_CATEGORIES.includes(category as never)) {
      query = `SELECT id, name, category, filename, size_bytes, uploaded_by, created_at
               FROM documents WHERE category = $1 ORDER BY created_at DESC`
      values.push(category)
    }
    const { rows } = await pool.query<Document>(query, values)
    res.json(ok(rows))
  } catch (e) {
    res.status(500).json(err('Internal server error'))
  }
})

documentsRouter.post('/', requireAuth(['admin', 'trainer']), (req, res) => {
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json(err(uploadErr.message))
      return
    }
    try {
      if (!req.file) { res.status(400).json(err('Keine Datei hochgeladen')); return }
      const { name, category } = req.body as { name?: string; category?: string }
      if (!name || !category) { res.status(400).json(err('name and category required')); return }
      if (!VALID_CATEGORIES.includes(category as never)) { res.status(400).json(err('invalid category')); return }

      const { rows } = await pool.query<Document>(
        `INSERT INTO documents (name, category, filename, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, category, filename, size_bytes, uploaded_by, created_at`,
        [name.trim(), category, req.file.filename, req.file.size, req.user!.id],
      )
      res.status(201).json(ok(rows[0]))
    } catch (e) {
      res.status(500).json(err('Internal server error'))
    }
  })
})

documentsRouter.get('/:id/file', requireAuth(), async (req, res) => {
  try {
    const { rows } = await pool.query<Document>(
      'SELECT filename FROM documents WHERE id = $1',
      [req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Document not found')); return }
    const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads')
    const filePath = path.join(uploadDir, rows[0].filename)
    if (!fs.existsSync(filePath)) { res.status(404).json(err('File not found on disk')); return }
    res.sendFile(path.resolve(filePath))
  } catch (e) {
    res.status(500).json(err('Internal server error'))
  }
})

documentsRouter.delete('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const isAdmin = req.user!.role === 'admin'
    const query = isAdmin
      ? 'DELETE FROM documents WHERE id = $1 RETURNING filename'
      : 'DELETE FROM documents WHERE id = $1 AND uploaded_by = $2 RETURNING filename'
    const values = isAdmin ? [req.params.id] : [req.params.id, req.user!.id]

    const { rows } = await pool.query<{ filename: string }>(query, values)
    if (!rows[0]) { res.status(404).json(err('Document not found or no permission')); return }

    const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads')
    const filePath = path.join(uploadDir, rows[0].filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json(ok(null))
  } catch (e) {
    res.status(500).json(err('Internal server error'))
  }
})
