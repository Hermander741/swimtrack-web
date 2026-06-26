import { createApp } from './app'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

async function main() {
  await runMigrations()
  await runSeed()
  const app = createApp()
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => console.log(`Mermaids API running on port ${PORT}`))
}

main().catch(err => { console.error(err); process.exit(1) })
