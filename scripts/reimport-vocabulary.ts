import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { parseVocabularyFile, extractCorrectAnswer } from './parse-vocabulary'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reimportVocabulary() {
  console.log('♻️  Reimporting vocabulary data...')

  console.log('Deleting existing vocabulary questions...')
  const { error: deleteProgressError } = await supabase
    .from('user_progress')
    .delete()
    .eq('category_id', 'vocabulary')

  if (deleteProgressError) {
    console.error('Failed to clear user progress:', deleteProgressError)
    process.exit(1)
  }

  const { error: deleteQuestionsError } = await supabase
    .from('questions')
    .delete()
    .eq('category_id', 'vocabulary')

  if (deleteQuestionsError) {
    console.error('Failed to delete questions:', deleteQuestionsError)
    process.exit(1)
  }

  console.log('Importing fresh data...')

  const entries = parseVocabularyFile(path.join(process.cwd(), 'VHS-Lernportal Vocabualry.txt'))
  console.log(`Found ${entries.length} entries.`)

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
      console.error('Failed to insert question:', error)
    } else {
      inserted += 1
      if (inserted % 100 === 0) {
        console.log(`Inserted ${inserted} questions...`)
      }
    }
  }

  console.log(`✅ Reimport complete. Inserted ${inserted} questions.`)
}

reimportVocabulary()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reimport failed:', error)
    process.exit(1)
  })

