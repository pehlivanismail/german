import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { parseVocabularyFile, extractCorrectAnswer } from './parse-vocabulary'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function ensureUnitsExist(levels: string[]) {
  const uniqueLevels = Array.from(new Set(levels))
  const { data: existingUnits, error: fetchError } = await supabase
    .from('units')
    .select('id')
    .in('id', uniqueLevels)

  if (fetchError) {
    console.error('Error fetching units:', fetchError)
    throw fetchError
  }

  const existingIds = new Set((existingUnits || []).map((unit) => unit.id))
  const missing = uniqueLevels.filter((level) => !existingIds.has(level))

  if (missing.length > 0) {
    console.log(`Creating ${missing.length} missing units...`)
    const inserts = missing.map((level) => ({ id: level, title: level, order_index: 0 }))
    const { error: insertError } = await supabase.from('units').insert(inserts)
    if (insertError) {
      console.error('Error creating units:', insertError)
      throw insertError
    }
  }
}

function readVocabularyFile(): string {
  const filePath = path.join(process.cwd(), 'VHS-Lernportal Vocabualry.txt')
  if (!fs.existsSync(filePath)) {
    console.error('Vocabulary file not found:', filePath)
    process.exit(1)
  }
  return filePath
}

async function importVocabulary() {
  console.log('📚 Importing vocabulary into Supabase...')
  const filePath = readVocabularyFile()
  const entries = parseVocabularyFile(filePath)

  console.log(`Found ${entries.length} entries in source file.`)

  await ensureUnitsExist(entries.map((entry) => entry.level))

  let inserted = 0

  for (const entry of entries) {
    const correctAnswer = extractCorrectAnswer(entry.fullSentence, entry.blankSentence, entry.germanWord)

    const { error } = await supabase.from('questions').insert({
      german_word: entry.germanWord,
      english_translation: entry.englishTranslation,
      full_sentence: entry.fullSentence,
      blank_sentence: entry.blankSentence,
      english_sentence: entry.englishSentence,
      unit_id: entry.level,
      category_id: 'vocabulary',
      correct_answer: correctAnswer,
    })

    if (error) {
      console.error('Error inserting question:', error)
    } else {
      inserted += 1
      if (inserted % 100 === 0) {
        console.log(`Inserted ${inserted} questions...`)
      }
    }
  }

  console.log(`✅ Import complete. Inserted ${inserted} questions.`)
  console.log('💡 If you need to reimport, run `npm run reimport:vocabulary`.')
}

importVocabulary()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Import failed:', error)
    process.exit(1)
  })

