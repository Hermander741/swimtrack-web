import bcrypt from 'bcryptjs'
import { pool } from './pool'

export async function runSeed(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return

  const { rows } = await pool.query('SELECT id FROM users LIMIT 1')
  if (rows.length > 0) return

  const hash = await bcrypt.hash(password, 12)
  await pool.query(
    `INSERT INTO users (email, name, role, password_hash, avatar_color)
     VALUES ($1, $2, 'admin', $3, '#0EA5E9')`,
    [email, 'Admin', hash],
  )
  console.log(`First admin created: ${email}`)
}
