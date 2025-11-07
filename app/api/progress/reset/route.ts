import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/supabase-api'
import { resetProgress } from '@/lib/db-supabase'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserIdFromRequest(authHeader)
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const level = request.nextUrl.searchParams.get('level')
    if (!level) {
      return NextResponse.json({ message: 'Level parameter is required' }, { status: 400 })
    }

    const result = await resetProgress(userId, level)
    if (!result.success) {
      return NextResponse.json(
        {
          message: result.error?.message || 'Failed to reset progress',
          error: result.error?.code || 'RESET_FAILED',
          details: result.error?.details,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error resetting progress:', error)
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 })
  }
}

