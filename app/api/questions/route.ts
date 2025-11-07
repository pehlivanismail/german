import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/supabase-api'
import { getQuestionsByLevel } from '@/lib/db-supabase'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserIdFromRequest(authHeader)

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const level = request.nextUrl.searchParams.get('level')
    if (!level) {
      return NextResponse.json({ message: 'Level query parameter is required' }, { status: 400 })
    }

    const questions = await getQuestionsByLevel(userId, level)

    const formatted = questions.map((q) => ({
      id: q.id,
      germanWord: q.german_word,
      englishTranslation: q.english_translation,
      fullSentence: q.full_sentence,
      blankSentence: q.blank_sentence,
      englishSentence: q.english_sentence,
      level: q.unit_id,
      correctAnswer: q.correct_answer,
      categoryId: q.category_id,
      status: q.status,
      attempts: q.attempts,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      {
        message: error?.message || 'Failed to load questions',
        details: error?.details,
      },
      { status: 500 }
    )
  }
}

