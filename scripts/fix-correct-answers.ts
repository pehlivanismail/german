import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

function extractCorrectAnswer(fullSentence: string, blankSentence: string, germanWord: string): string {
  let correctAnswer = ''
  if (fullSentence && blankSentence) {
    const blankIndex = blankSentence.indexOf('__')
    if (blankIndex !== -1) {
      const beforeBlank = blankSentence.substring(0, blankIndex)
      const afterBlank = blankSentence.substring(blankIndex + 2)

      const beforeIndex = fullSentence.indexOf(beforeBlank)
      if (beforeIndex !== -1) {
        const startPos = beforeIndex + beforeBlank.length
        const remaining = fullSentence.substring(startPos)

        const afterIndex = remaining.indexOf(afterBlank)
        if (afterIndex !== -1) {
          const answerPart = remaining.substring(0, afterIndex).trim()
          correctAnswer = answerPart
        } else {
          const match = remaining.match(/^([^\s,\.!?;:]+(?:\s+[^\s,\.!?;:]+)*)/)
          if (match) {
            correctAnswer = match[1].trim()
          } else {
            correctAnswer = germanWord.trim()
          }
        }
      } else {
        correctAnswer = germanWord.trim()
      }
    } else {
      correctAnswer = germanWord.trim()
    }
  } else {
    correctAnswer = germanWord.trim()
  }

  return correctAnswer.replace(/[.,!?;:]+$/, '')
}

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixCorrectAnswers() {
  console.log('🔧 Fixing correct answers in database...')

  let allQuestions: any[] = []
  let offset = 0
  const limit = 1000
  let hasMore = true

  console.log('\n📥 Fetching all questions from database...')

  while (hasMore) {
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('id, correct_answer, full_sentence, blank_sentence, german_word, unit_id')
      .eq('category_id', 'vocabulary')
      .range(offset, offset + limit - 1)

    if (fetchError) {
      console.error('Error fetching questions:', fetchError)
      return
    }

    if (questions && questions.length > 0) {
      allQuestions = allQuestions.concat(questions)
      console.log(`  Fetched ${allQuestions.length} questions so far...`)
      offset += limit
      hasMore = questions.length === limit
    } else {
      hasMore = false
    }
  }

  console.log(`\n📊 Found ${allQuestions.length} total questions in database`)

  let updated = 0
  let skipped = 0
  let errors = 0
  const sampleFixes: Array<{ old: string; new: string; id: string }> = []

  console.log('\n🔄 Processing questions...\n')

  for (const question of allQuestions) {
    const correctAnswer = extractCorrectAnswer(
      question.full_sentence || '',
      question.blank_sentence || '',
      question.german_word || ''
    )

    if (question.correct_answer !== correctAnswer) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ correct_answer: correctAnswer })
        .eq('id', question.id)

      if (updateError) {
        console.error(`❌ Error updating question ${question.id}:`, updateError)
        errors += 1
      } else {
        updated += 1
        if (sampleFixes.length < 10) {
          sampleFixes.push({ old: question.correct_answer || '', new: correctAnswer, id: question.id })
        }
        if (updated % 100 === 0) {
          console.log(`  ✅ Updated ${updated} questions...`)
        }
      }
    } else {
      skipped += 1
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Update Summary:')
  console.log(`   ✅ Updated: ${updated} questions`)
  console.log(`   ⏭️  Skipped: ${skipped} questions (already correct)`)
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors} questions`)
  }
  console.log('='.repeat(60))

  if (sampleFixes.length > 0) {
    console.log('\n📝 Sample fixes:')
    for (const fix of sampleFixes) {
      console.log(`   "${fix.old}" → "${fix.new}" (ID: ${fix.id})`)
    }
  } else {
    console.log('\n✅ All answers are already correct!')
  }
}

fixCorrectAnswers()
  .then(() => {
    console.log('\n✅ Done! Correct answers have been fixed.')
    console.log('\n💡 Refresh your browser to see the updated questions.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })

