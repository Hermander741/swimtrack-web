import fs from 'fs'
import path from 'path'
import { pool } from './pool'

export async function runMigrations(): Promise<void> {
  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await pool.query(sql)
    console.log(`Migration applied: ${file}`)
  }
}
