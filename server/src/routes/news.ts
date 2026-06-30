import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'

export const newsRouter = Router()

// ── News Posts ────────────────────────────────────────────────────────────────

newsRouter.get('/posts', requireAuth(), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.title, n.content, n.pinned, n.created_at, n.updated_at,
              u.name AS author_name, u.avatar_color AS author_color
       FROM news_posts n
       LEFT JOIN users u ON u.id = n.author_id
       ORDER BY n.pinned DESC, n.created_at DESC
       LIMIT 50`,
    )
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.post('/posts', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    const { title, content, pinned } = req.body as { title?: string; content?: string; pinned?: boolean }
    if (!title?.trim() || !content?.trim()) { res.status(400).json(err('Titel und Inhalt erforderlich')); return }
    const { rows } = await pool.query(
      `INSERT INTO news_posts (title, content, pinned, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, content, pinned, created_at, updated_at`,
      [title.trim(), content.trim(), pinned ?? false, req.user!.id],
    )
    res.status(201).json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.patch('/posts/:id', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    const { title, content, pinned } = req.body as { title?: string; content?: string; pinned?: boolean }
    if (!title?.trim() || !content?.trim()) { res.status(400).json(err('Titel und Inhalt erforderlich')); return }
    const { rows } = await pool.query(
      `UPDATE news_posts SET title=$1, content=$2, pinned=$3, updated_at=now()
       WHERE id=$4 RETURNING id, title, content, pinned, created_at, updated_at`,
      [title.trim(), content.trim(), pinned ?? false, req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.delete('/posts/:id', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM news_posts WHERE id=$1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// ── Motivational Quotes ───────────────────────────────────────────────────────

newsRouter.get('/quote/today', requireAuth(), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, text, attribution FROM motivational_quotes WHERE active = true ORDER BY created_at`,
    )
    if (!rows.length) { res.json(ok(null)); return }
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400_000)
    res.json(ok(rows[dayOfYear % rows.length]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.get('/quotes', requireAuth(['trainer', 'admin']), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT q.id, q.text, q.attribution, q.active, q.created_at, u.name AS created_by_name
       FROM motivational_quotes q LEFT JOIN users u ON u.id = q.created_by
       ORDER BY q.created_at DESC`,
    )
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.post('/quotes', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    const { text, attribution } = req.body as { text?: string; attribution?: string }
    if (!text?.trim()) { res.status(400).json(err('Text erforderlich')); return }
    const { rows } = await pool.query(
      `INSERT INTO motivational_quotes (text, attribution, created_by)
       VALUES ($1, $2, $3) RETURNING id, text, attribution, active, created_at`,
      [text.trim(), attribution?.trim() || null, req.user!.id],
    )
    res.status(201).json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.patch('/quotes/:id', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    const { text, attribution, active } = req.body as { text?: string; attribution?: string; active?: boolean }
    if (!text?.trim()) { res.status(400).json(err('Text erforderlich')); return }
    const { rows } = await pool.query(
      `UPDATE motivational_quotes SET text=$1, attribution=$2, active=$3
       WHERE id=$4 RETURNING id, text, attribution, active, created_at`,
      [text.trim(), attribution?.trim() || null, active ?? true, req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

newsRouter.delete('/quotes/:id', requireAuth(['trainer', 'admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM motivational_quotes WHERE id=$1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
