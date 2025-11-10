import { getSupabaseAdmin } from './supabase-admin'

export interface QuestionWithProgress {
  id: string
  german_word: string
  english_translation: string
  full_sentence: string
  blank_sentence: string
  english_sentence: string
  unit_id: string
  correct_answer: string
  category_id: string | null
  status?: 'pending' | 'passed' | 'failed'
  attempts?: number
}

export interface LevelProgress {
  level: string
  passed: number
  failed: number
  remaining: number
  total: number
  percentage: number
}

export async function getQuestionsByLevel(userId: string, level: string) {
  const supabase = getSupabaseAdmin()

  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select(
      'id, german_word, english_translation, full_sentence, blank_sentence, english_sentence, unit_id, correct_answer, category_id'
    )
    .eq('unit_id', level)
    .order('id', { ascending: true })

  if (questionError) {
    throw questionError
  }

  if (!questions || questions.length === 0) {
    return []
  }

  const questionIds = questions.map((q) => q.id)

  const { data: progressRows, error: progressError } = await supabase
    .from('user_progress')
    .select('question_id, status, attempts')
    .eq('user_id', userId)
    .in('question_id', questionIds)

  if (progressError) {
    throw progressError
  }

  const progressMap = new Map<string, { status: 'pending' | 'passed' | 'failed'; attempts: number }>()
  for (const row of progressRows || []) {
    progressMap.set(row.question_id, {
      status: (row.status as 'pending' | 'passed' | 'failed') || 'pending',
      attempts: row.attempts ?? 0,
    })
  }

  return questions.map((question) => {
    const progress = progressMap.get(question.id) || { status: 'pending', attempts: 0 }
    return {
      id: question.id,
      german_word: question.german_word,
      english_translation: question.english_translation,
      full_sentence: question.full_sentence,
      blank_sentence: question.blank_sentence,
      english_sentence: question.english_sentence,
      unit_id: question.unit_id,
      correct_answer: question.correct_answer,
      category_id: question.category_id,
      status: progress.status,
      attempts: progress.attempts,
    }
  })
}

export async function getLevelsProgress(userId: string): Promise<LevelProgress[]> {
  const supabase = getSupabaseAdmin()

  const questions: { id: string; unit_id: string | null }[] = []
  const pageSize = 1000
  let questionPage = 0
  while (true) {
    const from = questionPage * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('questions')
      .select('id, unit_id')
      .range(from, to)

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      questions.push(...data)
    }

    if (!data || data.length < pageSize) {
      break
    }

    questionPage += 1
  }

  const levelMap = new Map<string, LevelProgress>()

  for (const question of questions || []) {
    if (!question.unit_id) continue
    if (!levelMap.has(question.unit_id)) {
      levelMap.set(question.unit_id, {
        level: question.unit_id,
        passed: 0,
        failed: 0,
        remaining: 0,
        total: 0,
        percentage: 0,
      })
    }
    const entry = levelMap.get(question.unit_id)!
    entry.total += 1
  }

  if (levelMap.size === 0) {
    return []
  }

  const progressRows: { question_id: string; status: string | null }[] = []
  let progressPage = 0
  while (true) {
    const from = progressPage * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('user_progress')
      .select('question_id, status')
      .eq('user_id', userId)
      .range(from, to)

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      progressRows.push(...data)
    }

    if (!data || data.length < pageSize) {
      break
    }

    progressPage += 1
  }

  const questionToLevel = new Map<string, string>()
  for (const question of questions || []) {
    const unitId = question.unit_id
    if (!unitId) continue
    questionToLevel.set(question.id, unitId)
  }

  for (const row of progressRows) {
    const level = questionToLevel.get(row.question_id)
    if (!level) continue
    const entry = levelMap.get(level)
    if (!entry) continue

    if (row.status === 'passed') {
      entry.passed += 1
    } else if (row.status === 'failed') {
      entry.failed += 1
    }
  }

  for (const entry of levelMap.values()) {
    entry.remaining = Math.max(entry.total - entry.passed - entry.failed, 0)
    entry.percentage = entry.total > 0 ? Math.round((entry.passed / entry.total) * 100) : 0
  }

  return Array.from(levelMap.values())
}

export async function updateProgress(
  userId: string,
  questionId: string,
  isCorrect: boolean,
  answer?: string,
): Promise<{ success: boolean; error?: any }> {
  const supabase = getSupabaseAdmin()

  const { data: questionMeta, error: questionMetaError } = await supabase
    .from('questions')
    .select('unit_id, category_id')
    .eq('id', questionId)
    .maybeSingle()

  if (questionMetaError) {
    console.error('Error fetching question metadata:', questionMetaError)
    return { success: false, error: questionMetaError }
  }

  const resolvedUnitId = questionMeta?.unit_id ?? null
  const resolvedCategoryId = questionMeta?.category_id ?? null

  const { data: existing } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    const newStatus = isCorrect ? 'passed' : 'failed'

    const { error: updateError } = await supabase
      .from('user_progress')
      .update({
        status: newStatus,
        attempts: existing.attempts + 1,
        last_attempted: now,
        last_answer: answer || existing.last_answer,
        unit_id: resolvedUnitId ?? existing.unit_id ?? null,
        category_id: resolvedCategoryId ?? existing.category_id ?? null,
      })
      .eq('user_id', userId)
      .eq('question_id', questionId)

    if (updateError) {
      console.error('Error updating progress:', updateError)
      console.error('Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      })
      return { success: false, error: updateError }
    }
    return { success: true }
  }

  const { error: insertError } = await supabase.from('user_progress').insert({
    user_id: userId,
    question_id: questionId,
    unit_id: resolvedUnitId,
    category_id: resolvedCategoryId,
    status: isCorrect ? 'passed' : 'failed',
    attempts: 1,
    last_attempted: now,
    last_answer: answer || null,
  })

  if (insertError) {
    console.error('Error inserting progress:', insertError)
    console.error('Insert error details:', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    })
    return { success: false, error: insertError }
  }

  return { success: true }
}

export async function resetProgress(userId: string, level: string) {
  const supabase = getSupabaseAdmin()

  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select('id')
    .eq('unit_id', level)

  if (questionError) {
    throw questionError
  }

  const ids = (questions || []).map((q) => q.id)
  if (ids.length === 0) {
    return { success: true }
  }

  const { error: deleteError } = await supabase
    .from('user_progress')
    .delete()
    .eq('user_id', userId)
    .in('question_id', ids)

  if (deleteError) {
    console.error('Error resetting progress:', deleteError)
    return { success: false, error: deleteError }
  }

  return { success: true }
}

