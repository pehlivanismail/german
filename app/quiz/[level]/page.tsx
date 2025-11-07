'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-supabase'

interface Question {
  id: string
  germanWord: string
  englishTranslation: string
  fullSentence: string
  blankSentence: string
  englishSentence: string
  level: string
  correctAnswer: string
}

interface QuestionWithProgress extends Question {
  status?: 'pending' | 'passed' | 'failed'
  attempts?: number
  categoryId?: string
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const level = params.level as string
  const { user, loading: authLoading, getSessionToken } = useAuth()
  const [questions, setQuestions] = useState<QuestionWithProgress[]>([]) // Filtered questions for quiz
  const [allQuestions, setAllQuestions] = useState<QuestionWithProgress[]>([]) // All questions for stats
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const [quizMode, setQuizMode] = useState<'focus_failed' | 'review_all'>('focus_failed')

  // Calculate stats from ALL questions, not just filtered ones
  const progressStats = {
    passed: allQuestions.filter((q) => q.status === 'passed').length,
    failed: allQuestions.filter((q) => q.status === 'failed').length,
    pending: allQuestions.filter((q) => !q.status || q.status === 'pending').length,
    total: allQuestions.length,
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && level) {
      fetchQuestions()
    }
  }, [user, level])

  useEffect(() => {
    if (!feedback && inputRef.current && questions.length > 0) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [currentIndex, feedback, questions.length])

  useEffect(() => {
    if (questions.length === 0) {
      setCurrentIndex(0)
      return
    }

    if (currentIndex >= questions.length) {
      setCurrentIndex(questions.length - 1)
    }
  }, [questions, currentIndex])

  const fetchQuestions = async (preserveIndex = false) => {
    try {
      const token = await getSessionToken()
      if (!token) {
        console.error('No session token available')
        return
      }
      const response = await fetch(`/api/questions?level=${level}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()

        // Store all questions for stats calculation
        setAllQuestions(data)

        const failedQuestions = data.filter((q: QuestionWithProgress) => q.status === 'failed')
        const pendingQuestions = data.filter((q: QuestionWithProgress) => q.status === 'pending')
        const passedQuestions = data.filter((q: QuestionWithProgress) => q.status === 'passed')

        let sortedQuestions: QuestionWithProgress[] = []

        if (failedQuestions.length > 0) {
          setQuizMode('focus_failed')
          sortedQuestions = failedQuestions
        } else if (pendingQuestions.length > 0) {
          setQuizMode('focus_failed')
          sortedQuestions = pendingQuestions
        } else {
          setQuizMode('review_all')
          sortedQuestions = passedQuestions
        }

        sortedQuestions = sortedQuestions.sort(() => Math.random() - 0.5)

        if (preserveIndex && questions.length > 0 && currentIndex < questions.length) {
          const currentQuestionId = questions[currentIndex].id
          const newIndex = sortedQuestions.findIndex((q) => q.id === currentQuestionId)
          if (newIndex !== -1) {
            setCurrentIndex(newIndex)
          } else {
            setCurrentIndex(0)
          }
        } else if (sortedQuestions.length > 0) {
          setCurrentIndex(0)
        }

        setQuestions(sortedQuestions)
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch questions:', errorData)
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return

    const currentQuestion = questions[currentIndex]
    const normalizedAnswer = answer.trim().toLowerCase().replace(/\s+/g, ' ')
    const normalizedCorrect = currentQuestion.correctAnswer.trim().toLowerCase().replace(/\s+/g, ' ')
    const isCorrect = normalizedAnswer === normalizedCorrect

    try {
      const token = await getSessionToken()
      if (!token) {
        setFeedback({ type: 'error', message: 'Not authenticated. Please sign in again.' })
        router.push('/auth/signin')
        return
      }

      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: answer.trim(),
          isCorrect,
          unitId: currentQuestion.level || level,
          categoryId: currentQuestion.categoryId || 'vocabulary',
        }),
      })

      if (response.ok) {
        // Update allQuestions for accurate stats
        const updatedAll = allQuestions.map((q) =>
          q.id === currentQuestion.id
            ? {
                ...q,
                status: (isCorrect ? 'passed' : 'failed') as QuestionWithProgress['status'],
                attempts: (q.attempts || 0) + 1,
              }
            : q
        ) as QuestionWithProgress[]
        setAllQuestions(updatedAll)

        if (isCorrect) {
          setFeedback({ type: 'success', message: 'Correct! ✓' })
          const updated = [...questions]
          updated[currentIndex].status = 'passed'
          updated[currentIndex].attempts = (updated[currentIndex].attempts || 0) + 1
          
          // If we're in focus_failed mode and this question is now passed, remove it from the list
          if (quizMode === 'focus_failed') {
            updated.splice(currentIndex, 1)
            setQuestions(updated)
            
            setTimeout(() => {
              setFeedback(null)
              setAnswer('')
              
              // Adjust index: if we removed the last item, go to the new last item
              // Otherwise, stay at current index (which now points to the next question)
              const newIndex = currentIndex >= updated.length ? Math.max(0, updated.length - 1) : currentIndex
              
              if (updated.length > 0) {
                setCurrentIndex(newIndex)
              } else {
                // No more failed/pending questions, refetch to see if we should switch to review mode
                fetchQuestions(false)
              }
            }, 2000)
          } else {
            // Review mode - just update and move to next
            setQuestions(updated)
            setTimeout(() => {
              setFeedback(null)
              setAnswer('')
              const nextIndex = currentIndex + 1
              if (nextIndex < updated.length) {
                setCurrentIndex(nextIndex)
              } else {
                // Reached end, refetch to see if there are failed questions to work on
                fetchQuestions(false)
              }
            }, 2000)
          }
        } else {
          setFeedback({
            type: 'error',
            message: `Incorrect. The correct answer is "${currentQuestion.correctAnswer}"`,
          })
          const updated = [...questions]
          updated[currentIndex].status = 'failed'
          updated[currentIndex].attempts = (updated[currentIndex].attempts || 0) + 1
          setQuestions(updated)
          
          // When failed, stay on the same question (don't advance index)
          setTimeout(() => {
            setFeedback(null)
            setAnswer('')
            // Stay on same index to ask the question again
          }, 2000)
        }
      } else {
        const errorData = await response.json()
        setFeedback({ type: 'error', message: errorData.message || 'Failed to save progress' })
        console.error('Failed to save progress:', errorData)
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
      setFeedback({
        type: 'error',
        message: `Failed to save progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No questions available for this level.</p>
          <button
            onClick={() => router.push('/levels')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Levels
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No questions available right now.</p>
          <button
            onClick={() => router.push('/levels')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Levels
          </button>
        </div>
      </div>
    )
  }
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-gray-800">{level}</h1>
            <span className="text-gray-600">
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>

          <div className="text-sm text-gray-500 mb-2">
            Mode: <span className="font-semibold capitalize">{quizMode.replace('_', ' ')}</span>
            {quizMode === 'focus_failed' && (
              <span className="ml-2">({progressStats.failed + progressStats.pending} unsolved)</span>
            )}
          </div>

          <div className="mb-3 flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-700">
                Passed: <strong>{progressStats.passed}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-700">
                Failed: <strong>{progressStats.failed}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-gray-700">
                Remaining: <strong>{progressStats.pending}</strong>
              </span>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="flex h-full">
              {progressStats.total > 0 && progressStats.passed > 0 && (
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${(progressStats.passed / progressStats.total) * 100}%` }}
                  title={`${progressStats.passed} passed`}
                />
              )}
              {progressStats.total > 0 && progressStats.failed > 0 && (
                <div
                  className="bg-red-500 h-full transition-all"
                  style={{ width: `${(progressStats.failed / progressStats.total) * 100}%` }}
                  title={`${progressStats.failed} failed`}
                />
              )}
              {progressStats.total > 0 && progressStats.pending > 0 && (
                <div
                  className="bg-gray-400 h-full transition-all"
                  style={{ width: `${(progressStats.pending / progressStats.total) * 100}%` }}
                  title={`${progressStats.pending} remaining`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">English Translation:</p>
            <p className="text-lg text-gray-800 mb-4">{currentQuestion.englishSentence}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">Fill in the blank:</p>
            <p className="text-2xl font-semibold text-gray-800 mb-4">{currentQuestion.blankSentence}</p>
          </div>

          {feedback && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                feedback.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                ref={inputRef}
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your answer"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 bg-white outline-none"
                disabled={!!feedback}
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={!answer.trim() || !!feedback}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {feedback ? 'Continue...' : 'Submit Answer'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/levels')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
            </div>
          </form>

          {currentQuestion.status && (
            <div className="mt-4 text-sm text-gray-600">
              Status: <span className="font-semibold capitalize">{currentQuestion.status}</span>
              {currentQuestion.attempts && currentQuestion.attempts > 0 && (
                <span className="ml-4">Attempts: {currentQuestion.attempts}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

