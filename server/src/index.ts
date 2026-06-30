import 'dotenv/config'
import http from 'http'
import { createApp } from './app'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'
import { setupSocket } from './socket/index'
import { startTrainingPushCron } from './utils/trainingPushCron'
import { startDocumentReminderCron } from './cron/documentReminders'

async function main() {
  await runMigrations()
  await runSeed()
  const app = createApp()
  const httpServer = http.createServer(app)
  setupSocket(httpServer)
  startTrainingPushCron()
  startDocumentReminderCron()
  const PORT = process.env.PORT ?? 3001
  httpServer.listen(PORT, () => console.log(`Mermaids API running on port ${PORT}`))
}

main().catch(err => { console.error(err); process.exit(1) })
