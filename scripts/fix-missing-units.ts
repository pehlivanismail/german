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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixMissingUnits() {
  console.log('🔍 Scanning for missing units...')

  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select('unit_id')

  if (questionError) {
    console.error('Failed to load questions:', questionError)
    process.exit(1)
  }

  const unitsInQuestions = new Set((questions || []).map((q) => q.unit_id).filter(Boolean))

  const { data: existingUnits, error: unitError } = await supabase
    .from('units')
    .select('id')
    .in('id', Array.from(unitsInQuestions))

  if (unitError) {
    console.error('Failed to load units:', unitError)
    process.exit(1)
  }

  const existing = new Set((existingUnits || []).map((unit) => unit.id))
  const missing = Array.from(unitsInQuestions).filter((id) => !existing.has(id))

  if (missing.length === 0) {
    console.log('✅ No missing units detected.')
    return
  }

  console.log(`🛠️  Creating ${missing.length} missing units...`)

  const inserts = missing.map((id) => ({ id, title: id, order_index: 0 }))
  const { error: insertError } = await supabase.from('units').insert(inserts)

  if (insertError) {
    console.error('Failed to create missing units:', insertError)
    process.exit(1)
  }

  console.log('✅ Missing units inserted successfully.')
}

fixMissingUnits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })

