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

async function getProgressCount(): Promise<number> {
  const { count, error } = await supabase
    .from('user_progress')
    .select('question_id', { head: true, count: 'exact' })

  if (error) {
    throw error
  }

  return count ?? 0
}

async function resetAllProgress() {
  console.log('🔄 Preparing to reset all user progress…')

  const beforeCount = await getProgressCount()
  console.log(`   Found ${beforeCount} progress record${beforeCount === 1 ? '' : 's'} before reset.`)

  if (beforeCount === 0) {
    console.log('✅ No progress records found. Nothing to reset.')
    return
  }

  const { error: deleteNonNullError } = await supabase.from('user_progress').delete().not('user_id', 'is', null)
  if (deleteNonNullError) {
    throw deleteNonNullError
  }

  const { error: deleteNullError } = await supabase.from('user_progress').delete().is('user_id', null)
  if (deleteNullError) {
    throw deleteNullError
  }

  const afterCount = await getProgressCount()
  console.log(`   Progress records after reset: ${afterCount}`)

  if (afterCount === 0) {
    console.log('✅ All user progress has been cleared successfully.')
  } else {
    console.warn('⚠️ Some progress records remain after reset. Please verify manually.')
  }
}

resetAllProgress()
  .then(() => {
    console.log('\n🎉 Done! You can rerun the quiz to record fresh progress data.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed to reset progress:', error)
    process.exit(1)
  })


