import { NextRequest, NextResponse } from 'next/server'
import { updateProgress } from '@/lib/db-supabase'
import { getUserIdFromRequest } from '@/lib/supabase-api'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserIdFromRequest(authHeader)
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { questionId, answer, isCorrect, unitId, categoryId } = await request.json()

    if (!questionId || typeof isCorrect !== 'boolean') {
      return NextResponse.json({ message: 'Invalid request data' }, { status: 400 })
    }

    const result = await updateProgress(userId, questionId, isCorrect, answer, unitId, categoryId)

    if (!result.success) {
      console.error('Progress update failed:', result.error)
      return NextResponse.json(
        {
          message: result.error?.message || 'Failed to save progress',
          error: result.error?.code || 'UPDATE_FAILED',
          details: result.error?.details,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Progress saved successfully' })
  } catch (error: any) {
    console.error('Error updating progress:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    })
    return NextResponse.json(
      {
        message: error?.message || 'Internal server error',
        error: error?.code || 'UNKNOWN_ERROR',
        details: error?.details,
        hint: error?.hint,
      },
      { status: 500 }
    )
  }
}

