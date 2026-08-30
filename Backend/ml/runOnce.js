/**
 * Run a single automation pass and exit. For demos and manual verification:
 *   npm run automation:once
 *
 * Uses the same DB and the same code path the 15-minute cron uses.
 */
import { connect, disconnect } from 'mongoose'
import { env } from '../config/env.js'
import { runAutomationPass } from './automationJob.js'

try {
  await connect(env.dbUrl, { family: 4 })
  console.log('[runOnce] Connected to MongoDB')

  const summary = await runAutomationPass()
  console.log('[runOnce] Result:', JSON.stringify(summary, null, 2))
} catch (err) {
  console.error('[runOnce] Failed:', err.message)
  process.exitCode = 1
} finally {
  await disconnect()
  console.log('[runOnce] Disconnected')
}
