import { NextRequest, NextResponse } from 'next/server'
import { getLevelsProgress } from '@/lib/db-supabase'
import { getUserIdFromRequest } from '@/lib/supabase-api'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserIdFromRequest(authHeader)
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const levels = await getLevelsProgress(userId)

    const formatted = levels.map((level) => ({
      level: level.level,
      passed: level.passed,
      failed: level.failed,
      remaining: level.remaining,
      total: level.total,
      percentage: level.percentage,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('Error loading levels:', error)
    return NextResponse.json({ message: error?.message || 'Failed to load levels' }, { status: 500 })
  }
}

