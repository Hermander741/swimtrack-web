import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { uploadDir } from '../middleware/upload'
import webpush from 'web-push'

export const membersRouter = Router()

const memberDocDir = path.join(uploadDir, 'member-docs')
if (!fs.existsSync(memberDocDir)) fs.mkdirSync(memberDocDir, { recursive: true })

const memberDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, memberDocDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
    cb(null, `${crypto.randomUUID()}_${safe}${ext}`)
  },
})

const memberDocUpload = multer({
  storage: memberDocStorage,
  limits: { fileSize: 26_214_400 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Nur PDF-Dateien erlaubt'))
  },
})

const CATEGORIES = ['anmeldung', 'sportattest', 'meldezettel', 'sonstiges'] as const

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_CONTACT) return
  webpush.setVapidDetails(process.env.VAPID_CONTACT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  vapidReady = true
}

async function notifyTrainersOfNewDoc(uploaderName: string, memberName: string, category: string) {
  ensureVapid()
  if (!vapidReady) return
  try {
    const { rows: trainers } = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('admin', 'trainer')`,
    )
    if (trainers.length === 0) return
    const trainerIds = trainers.map(t => t.id)
    const { rows: subs } = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)`,
      [trainerIds],
    )
    const payload = JSON.stringify({
      title: 'Neues Dokument hochgeladen',
      body: `${uploaderName} hat ein Dokument für ${memberName} hochgeladen (${category}) — Freigabe erforderlich`,
      icon: '/icon-192.png',
      data: { url: '/mitglieder' },
    })
    await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(() => {}),
    ))
  } catch { /* ignore */ }
}

// Helper: can this user access userId's documents?
async function canAccessDocs(requesterId: string, requesterRole: string, targetUserId: string): Promise<boolean> {
  if (requesterRole === 'admin' || requesterRole === 'trainer') return true
  if (requesterId === targetUserId) return true
  // Check parent-child
  const { rows } = await pool.query(
    `SELECT 1 FROM parent_child WHERE parent_id = $1 AND child_id = $2`,
    [requesterId, targetUserId],
  )
  return rows.length > 0
}

// ── Member Documents ──────────────────────────────────────────────────────────

// GET /api/members/:userId/documents
membersRouter.get('/:userId/documents', requireAuth(), async (req, res) => {
  const { userId } = req.params
  const user = req.user!
  if (!await canAccessDocs(user.id, user.role, String(userId))) {
    res.status(403).json(err('Kein Zugriff')); return
  }
  const isStaff = user.role === 'admin' || user.role === 'trainer'
  const { rows } = await pool.query(
    `SELECT md.id, md.user_id, md.filename, md.original_name, md.category, md.status,
            md.uploaded_by, u.name AS uploader_name,
            md.approved_by, a.name AS approver_name, md.approved_at, md.valid_until, md.created_at
     FROM member_documents md
     LEFT JOIN users u ON u.id = md.uploaded_by
     LEFT JOIN users a ON a.id = md.approved_by
     WHERE md.user_id = $1
     ${isStaff ? '' : "AND md.status = 'approved'"}
     ORDER BY md.created_at DESC`,
    [userId],
  )
  res.json(ok(rows))
})

// POST /api/members/:userId/documents
membersRouter.post('/:userId/documents', requireAuth(), (req, res) => {
  memberDocUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) { res.status(400).json(err(uploadErr.message)); return }
    const { userId } = req.params
    const user = req.user!
    if (!await canAccessDocs(user.id, user.role, String(userId))) {
      if (req.file) fs.unlinkSync(req.file.path)
      res.status(403).json(err('Kein Zugriff')); return
    }
    if (!req.file) { res.status(400).json(err('Keine Datei')); return }
    const category = (req.body.category as string) ?? 'sonstiges'
    if (!CATEGORIES.includes(category as never)) {
      fs.unlinkSync(req.file.path); res.status(400).json(err('Ungültige Kategorie')); return
    }
    const isStaff = user.role === 'admin' || user.role === 'trainer'
    const status = isStaff ? 'approved' : 'pending'
    const approvedBy = isStaff ? user.id : null
    const approvedAt = isStaff ? new Date() : null

    const { rows } = await pool.query(
      `INSERT INTO member_documents (user_id, filename, original_name, category, status, uploaded_by, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, filename, original_name, category, status, created_at`,
      [userId, req.file.filename, req.file.originalname, category, status, user.id, approvedBy, approvedAt],
    )

    if (!isStaff) {
      const { rows: [member] } = await pool.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [userId])
      notifyTrainersOfNewDoc(user.name, member?.name ?? userId, category).catch(() => {})
    }

    res.status(201).json(ok(rows[0]))
  })
})

// PATCH /api/members/:userId/documents/:docId/approve
membersRouter.patch('/:userId/documents/:docId/approve', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { userId, docId } = req.params
  const { action } = req.body as { action: 'approve' | 'reject' }
  if (!['approve', 'reject'].includes(action)) { res.status(400).json(err('action muss approve oder reject sein')); return }
  const status = action === 'approve' ? 'approved' : 'rejected'

  // Look up validity rule for this document's category
  let validUntil: string | null = null
  if (action === 'approve') {
    const { rows: [doc] } = await pool.query<{ category: string }>(
      `SELECT category FROM member_documents WHERE id = $1`, [docId],
    )
    if (doc) {
      const { rows: [rule] } = await pool.query<{ validity_days: number }>(
        `SELECT validity_days FROM document_validity_rules WHERE category = $1`, [doc.category],
      )
      if (rule?.validity_days) {
        const d = new Date()
        d.setDate(d.getDate() + rule.validity_days)
        validUntil = d.toISOString().slice(0, 10)
      }
    }
  }

  const { rows } = await pool.query(
    `UPDATE member_documents
     SET status = $1, approved_by = $2, approved_at = NOW(),
         valid_until = CASE WHEN $5::text IS NOT NULL THEN $5::date ELSE valid_until END,
         reminder_sent = '[]'::jsonb
     WHERE id = $3 AND user_id = $4 RETURNING id, status, valid_until`,
    [status, req.user!.id, docId, userId, validUntil],
  )
  if (!rows[0]) { res.status(404).json(err('Dokument nicht gefunden')); return }
  res.json(ok(rows[0]))
})

// GET /api/members/:userId/documents/:docId/file
membersRouter.get('/:userId/documents/:docId/file', requireAuth(), async (req, res) => {
  const { userId, docId } = req.params
  const user = req.user!
  if (!await canAccessDocs(user.id, user.role, String(userId))) {
    res.status(403).json(err('Kein Zugriff')); return
  }
  const isStaff = user.role === 'admin' || user.role === 'trainer'
  const { rows } = await pool.query(
    `SELECT filename, original_name, status FROM member_documents WHERE id = $1 AND user_id = $2`,
    [docId, userId],
  )
  if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
  if (!isStaff && rows[0].status !== 'approved') { res.status(403).json(err('Dokument noch nicht freigegeben')); return }
  const resolved = path.resolve(memberDocDir, rows[0].filename)
  if (!resolved.startsWith(path.resolve(memberDocDir) + path.sep)) { res.status(400).json(err('Ungültiger Pfad')); return }
  if (!fs.existsSync(resolved)) { res.status(404).json(err('Datei nicht gefunden')); return }
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`)
  res.sendFile(resolved)
})

// DELETE /api/members/:userId/documents/:docId
membersRouter.delete('/:userId/documents/:docId', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { userId, docId } = req.params
  const { rows } = await pool.query(
    `DELETE FROM member_documents WHERE id = $1 AND user_id = $2 RETURNING filename`,
    [docId, userId],
  )
  if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
  const filePath = path.join(memberDocDir, rows[0].filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  res.json(ok(null))
})

// ── Validity Rules ────────────────────────────────────────────────────────────

// GET /api/members/validity-rules
membersRouter.get('/validity-rules', requireAuth(['admin', 'trainer']), async (_req, res) => {
  const { rows } = await pool.query(`SELECT category, validity_days, reminder_days FROM document_validity_rules ORDER BY category`)
  res.json(ok(rows))
})

// PATCH /api/members/validity-rules/:category
membersRouter.patch('/validity-rules/:category', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { category } = req.params
  const { validity_days, reminder_days } = req.body as { validity_days?: number; reminder_days?: number[] }
  if (!CATEGORIES.includes(category as never)) { res.status(400).json(err('Ungültige Kategorie')); return }
  if (validity_days !== undefined && (typeof validity_days !== 'number' || validity_days < 1)) {
    res.status(400).json(err('validity_days muss eine positive Zahl sein')); return
  }
  const { rows } = await pool.query(
    `INSERT INTO document_validity_rules (category, validity_days, reminder_days, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (category) DO UPDATE SET
       validity_days = EXCLUDED.validity_days,
       reminder_days = EXCLUDED.reminder_days,
       updated_at = NOW()
     RETURNING category, validity_days, reminder_days`,
    [category, validity_days ?? 365, reminder_days ?? [30, 7]],
  )
  res.json(ok(rows[0]))
})

// DELETE /api/members/validity-rules/:category
membersRouter.delete('/validity-rules/:category', requireAuth(['admin']), async (req, res) => {
  await pool.query(`DELETE FROM document_validity_rules WHERE category = $1`, [req.params.category])
  res.json(ok(null))
})

// ── Parent-Child ──────────────────────────────────────────────────────────────

// GET /api/members/parent-child — all relationships (admin/trainer)
membersRouter.get('/parent-child', requireAuth(['admin', 'trainer']), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT pc.parent_id, pc.child_id, p.name AS parent_name, c.name AS child_name
     FROM parent_child pc
     JOIN users p ON p.id = pc.parent_id
     JOIN users c ON c.id = pc.child_id
     ORDER BY c.name`,
  )
  res.json(ok(rows))
})

// GET /api/members/my-children — children of the logged-in parent
membersRouter.get('/my-children', requireAuth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.avatar_color, u.avatar_url
     FROM parent_child pc JOIN users u ON u.id = pc.child_id
     WHERE pc.parent_id = $1 ORDER BY u.name`,
    [req.user!.id],
  )
  res.json(ok(rows))
})

// POST /api/members/parent-child
membersRouter.post('/parent-child', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { parentId, childId } = req.body as { parentId?: string; childId?: string }
  if (!parentId || !childId) { res.status(400).json(err('parentId und childId erforderlich')); return }
  await pool.query(
    `INSERT INTO parent_child (parent_id, child_id, created_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [parentId, childId, req.user!.id],
  )
  res.status(201).json(ok(null))
})

// DELETE /api/members/parent-child
membersRouter.delete('/parent-child', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { parentId, childId } = req.body as { parentId?: string; childId?: string }
  if (!parentId || !childId) { res.status(400).json(err('parentId und childId erforderlich')); return }
  await pool.query(`DELETE FROM parent_child WHERE parent_id = $1 AND child_id = $2`, [parentId, childId])
  res.json(ok(null))
})

// GET /api/members/:userId/parents — parents of a member
membersRouter.get('/:userId/parents', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email FROM parent_child pc JOIN users u ON u.id = pc.parent_id WHERE pc.child_id = $1`,
    [req.params.userId],
  )
  res.json(ok(rows))
})

// GET /api/members/:userId/children — children of a member
membersRouter.get('/:userId/children', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email FROM parent_child pc JOIN users u ON u.id = pc.child_id WHERE pc.parent_id = $1`,
    [req.params.userId],
  )
  res.json(ok(rows))
})
