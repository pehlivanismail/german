import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function getArg(name: string): string | null {
  const prefix = `${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : null
}

async function main() {
  const email = getArg('--email')
  const explicitUserId = getArg('--userId')
  const level = getArg('--level')
  const passedCount = Number(getArg('--passed') ?? '5')
  const failedCount = Number(getArg('--failed') ?? '0')

  if ((!email && !explicitUserId) || !level) {
    console.error(
      'Usage: tsx scripts/seed-progress.ts --level=B1-L3 [--email=user@example.com | --userId=uuid] [--passed=5] [--failed=0]',
    )
    process.exit(1)
  }

  if (passedCount < 0 || failedCount < 0) {
    console.error('Passed and failed counts must be zero or greater.')
    process.exit(1)
  }

  const totalToSeed = passedCount + failedCount
  if (totalToSeed === 0) {
    console.error('At least one question must be marked as passed or failed.')
    process.exit(1)
  }

  console.log(`🎯 Seeding progress for ${email} on level ${level}…`)

  let userId = explicitUserId ?? null

  if (!userId) {
    const { data: authUser, error: authUserError } = await supabase
      .from('users', { schema: 'auth' })
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (authUserError || !authUser) {
      console.error('Failed to find Supabase auth user by email:', authUserError ?? 'Not found')
      process.exit(1)
    }

    userId = authUser.id
  }

  console.log(`   Using user id: ${userId}`)

  const { data: questionRows, error: questionError } = await supabase
    .from('questions')
    .select('id, unit_id, category_id')
    .eq('unit_id', level)
    .order('id', { ascending: true })
    .limit(totalToSeed)

  if (questionError) {
    console.error('Failed to fetch questions for level:', questionError)
    process.exit(1)
  }

  if (!questionRows || questionRows.length === 0) {
    console.error('No questions found for the provided level.')
    process.exit(1)
  }

  if (questionRows.length < totalToSeed) {
    console.warn(`⚠️ Only ${questionRows.length} questions available for ${level}. Will seed as many as possible.`)
  }

  const now = new Date().toISOString()
  const updates = questionRows.map((question, index) => {
    let status: 'passed' | 'failed'
    if (index < passedCount) {
      status = 'passed'
    } else if (index < passedCount + failedCount) {
      status = 'failed'
    } else {
      status = 'passed'
    }

    return {
      user_id: userId,
      question_id: question.id,
      unit_id: question.unit_id,
      category_id: question.category_id,
      status,
      attempts: 1,
      last_attempted: now,
      last_answer: status === 'passed' ? '***seeded***' : null,
    }
  })

  const targetQuestionIds = questionRows.map((q) => q.id)
  await supabase
    .from('user_progress')
    .delete()
    .eq('user_id', userId)
    .in('question_id', targetQuestionIds)

  const { error: upsertError } = await supabase
    .from('user_progress')
    .upsert(updates, { onConflict: 'user_id,question_id' })

  if (upsertError) {
    console.error('Failed to upsert seed progress:', upsertError)
    process.exit(1)
  }

  console.log(`✅ Seeded ${updates.length} progress record${updates.length === 1 ? '' : 's'} for ${email}.`)
  console.log('   Passed:', updates.filter((row) => row.status === 'passed').length)
  console.log('   Failed:', updates.filter((row) => row.status === 'failed').length)
  console.log('\nYou can now refresh the levels page to verify the numbers.')
}

main().catch((error) => {
  console.error('Unexpected error while seeding progress:', error)
  process.exit(1)
})


