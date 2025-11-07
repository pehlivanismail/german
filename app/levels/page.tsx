'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-supabase'

interface LevelProgress {
  level: string
  passed: number
  failed: number
  remaining: number
  total: number
  percentage: number
}

export default function LevelsPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut, getSessionToken } = useAuth()
  const [levels, setLevels] = useState<LevelProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchLevels()
    }
  }, [user])

  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchLevels()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])

  const defaultLevels: LevelProgress[] = useMemo(() => {
    const defaults = [
      'A1-L1',
      'A1-L2',
      'A1-L3',
      'A1-L4',
      'A1-L5',
      'A1-L6',
      'A1-L7',
      'A1-L8',
      'A1-L9',
      'A1-L10',
      'A1-L11',
      'A1-L12',
      'A2-L1',
      'A2-L2',
      'A2-L3',
      'A2-L4',
      'A2-L5',
      'A2-L6',
      'A2-L7',
      'A2-L8',
      'A2-L9',
      'A2-L10',
      'A2-L11',
      'A2-L12',
      'B1-L1',
      'B1-L2',
      'B1-L3',
      'B1-L4',
      'B1-L5',
      'B1-L6',
      'B1-L7',
      'B1-L8',
      'B1-L9',
      'B1-L10',
      'B1-L11',
      'B1-L12',
    ]

    return defaults.map((level) => ({
      level,
      passed: 0,
      failed: 0,
      remaining: 0,
      total: 0,
      percentage: 0,
    }))
  }, [])

  const mergedLevels = useMemo(() => {
    const map = new Map(defaultLevels.map((level) => [level.level, { ...level }]))

    for (const level of levels) {
      const existing = map.get(level.level) || {
        level: level.level,
        passed: 0,
        failed: 0,
        remaining: 0,
        total: 0,
        percentage: 0,
      }

      map.set(level.level, {
        ...existing,
        ...level,
      })
    }

    return Array.from(map.values())
  }, [levels, defaultLevels])

  const sortedLevels = useMemo(() => {
    const data = mergedLevels
    const getGroupInfo = (level: string) => {
      const match = level.match(/^([A-Z]\d)-L(\d+)$/)
      const group = match ? match[1] : 'Z'
      const lesson = match ? parseInt(match[2], 10) : Number.MAX_SAFE_INTEGER
      const groupOrder = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const groupIndex = groupOrder.indexOf(group)
      return {
        group,
        groupIndex: groupIndex === -1 ? Number.MAX_SAFE_INTEGER : groupIndex,
        lesson,
      }
    }

    return [...data].sort((a, b) => {
      const infoA = getGroupInfo(a.level)
      const infoB = getGroupInfo(b.level)

      if (infoA.groupIndex !== infoB.groupIndex) {
        return infoA.groupIndex - infoB.groupIndex
      }

      if (infoA.lesson !== infoB.lesson) {
        return infoA.lesson - infoB.lesson
      }

      return a.level.localeCompare(b.level)
    })
  }, [mergedLevels])

  const groupedLevels = useMemo(() => {
    return sortedLevels.reduce((acc, level) => {
      const groupMatch = level.level.match(/^([A-Z]\d)-/)
      const group = groupMatch ? groupMatch[1] : 'Other'
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(level)
      return acc
    }, {} as Record<string, LevelProgress[]>)
  }, [sortedLevels])

  const groupNames = useMemo(() => Object.keys(groupedLevels), [groupedLevels])

  useEffect(() => {
    if (groupNames.length === 0) {
      return
    }
    setActiveGroup((prev) => {
      if (prev && groupNames.includes(prev)) {
        return prev
      }
      return groupNames[0]
    })
  }, [groupNames])

  const visibleLevels = activeGroup ? groupedLevels[activeGroup] ?? [] : sortedLevels

  const fetchLevels = async () => {
    try {
      const token = await getSessionToken()
      const response = await fetch('/api/levels', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setLevels(data)
      }
    } catch (error) {
      console.error('Failed to fetch levels:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (level: string) => {
    if (!confirm(`Are you sure you want to reset progress for ${level}?`)) {
      return
    }

    try {
      const token = await getSessionToken()
      const response = await fetch(`/api/progress/reset?level=${level}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        fetchLevels()
      }
    } catch (error) {
      console.error('Failed to reset progress:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Select Your Level</h1>
          <div className="flex gap-4 items-center">
            <button
              onClick={fetchLevels}
              className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors flex items-center gap-2"
              title="Refresh Progress"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <span className="text-gray-600">Welcome, {user?.email}</span>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {groupNames.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            {groupNames.map((group) => {
              const summary = (groupedLevels[group] || []).reduce(
                (acc, level) => {
                  acc.total += level.total
                  acc.passed += level.passed
                  acc.failed += level.failed
                  acc.remaining += level.remaining
                  return acc
                },
                { total: 0, passed: 0, failed: 0, remaining: 0 }
              )
              const groupPercentage = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0

              return (
                <button
                  key={group}
                  onClick={() => setActiveGroup(group)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeGroup === group
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {group} ({groupPercentage}%)
                </button>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleLevels.map((level) => {
            const progress = levels.find((l) => l.level === level.level) || {
              level: level.level,
              passed: 0,
              failed: 0,
              remaining: 0,
              total: 0,
              percentage: 0,
            }

            return (
              <div key={level.level} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800">{level.level}</h2>
                  <span className="text-sm text-gray-500">
                    {progress.passed}/{progress.total}
                  </span>
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-gray-700">
                        Passed: <strong>{progress.passed}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-gray-700">
                        Failed: <strong>{progress.failed}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-400" />
                      <span className="text-gray-700">
                        Remaining: <strong>{progress.remaining}</strong>
                      </span>
                    </div>
                    <span className="text-gray-600 font-semibold">{progress.percentage}%</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="flex h-full">
                      {progress.total > 0 && progress.passed > 0 && (
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${(progress.passed / progress.total) * 100}%` }}
                          title={`${progress.passed} passed`}
                        />
                      )}
                      {progress.total > 0 && progress.failed > 0 && (
                        <div
                          className="bg-red-500 h-full transition-all"
                          style={{ width: `${(progress.failed / progress.total) * 100}%` }}
                          title={`${progress.failed} failed`}
                        />
                      )}
                      {progress.total > 0 && progress.remaining > 0 && (
                        <div
                          className="bg-gray-400 h-full transition-all"
                          style={{ width: `${(progress.remaining / progress.total) * 100}%` }}
                          title={`${progress.remaining} remaining`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/quiz/${level.level}`}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg text-center font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Start Learning
                  </Link>
                  <button
                    onClick={() => handleReset(level.level)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center"
                    title="Reset Progress"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

