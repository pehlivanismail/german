import { getSupabaseAdmin } from '../lib/supabase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function printLevels(userId: string) {
  const supabase = getSupabaseAdmin()
  const {
    data: questions,
    error: questionError,
  } = await supabase.from('questions').select('id, unit_id').order('unit_id', { ascending: true })

  if (questionError) {
    throw questionError
  }

  const totalsByLevel = new Map<string, number>()
  for (const question of questions || []) {
    if (!question.unit_id) continue
    totalsByLevel.set(question.unit_id, (totalsByLevel.get(question.unit_id) || 0) + 1)
  }

  const {
    data: progressRows,
    error: progressError,
  } = await supabase.from('user_progress').select('question_id, status').eq('user_id', userId)

  if (progressError) {
    throw progressError
  }

  const questionToLevel = new Map<string, string>()
  for (const question of questions || []) {
    questionToLevel.set(question.id, question.unit_id || '')
  }

  const summary = new Map<
    string,
    { total: number; passed: number; failed: number; remaining: number; percentage: number }
  >()

  for (const [level, total] of totalsByLevel.entries()) {
    summary.set(level, {
      total,
      passed: 0,
      failed: 0,
      remaining: total,
      percentage: 0,
    })
  }

  for (const row of progressRows || []) {
    const level = questionToLevel.get(row.question_id)
    if (!level) continue
    const entry = summary.get(level)
    if (!entry) continue
    if (row.status === 'passed') {
      entry.passed += 1
    } else if (row.status === 'failed') {
      entry.failed += 1
    }
  }

  for (const entry of summary.values()) {
    entry.remaining = Math.max(entry.total - entry.passed - entry.failed, 0)
    entry.percentage = entry.total > 0 ? Math.round((entry.passed / entry.total) * 100) : 0
  }

  const array = Array.from(summary.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, values]) => ({ level, ...values }))

  console.log(JSON.stringify(array, null, 2))
}

const userId = process.argv[2]

if (!userId) {
  console.error('Usage: npm run debug:levels -- <userId>')
  process.exit(1)
}

printLevels(userId).catch((error) => {
  console.error('Failed to compute levels summary:', error)
  process.exit(1)
})


