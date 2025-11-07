'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabaseClient, useAuth } from '@/lib/auth-supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const handleCallback = async () => {
      try {
        const supabase = getBrowserSupabaseClient()

        const redirectToLevels = async () => {
          await refreshSession()
          if (isMounted) {
            router.replace('/levels')
          }
        }

        const url = window.location.href
        const hasQueryCode = url.includes('code=')
        const hash = window.location.hash || ''
        const hasHashTokens = /access_token=/.test(hash)

        console.log('[Auth Callback] start', { url, hash, hasQueryCode, hasHashTokens })

        const pollForSession = (attempt = 0) => {
          supabase.auth
            .getSession()
            .then(({ data: { session } }) => {
              console.log('[Auth Callback] poll session', attempt, session)
              if (session) {
                redirectToLevels()
              } else if (attempt < 20) {
                setTimeout(() => pollForSession(attempt + 1), 200)
              } else if (isMounted) {
                setError('Authentication failed. Please sign in again.')
                router.replace('/auth/signin')
              }
            })
            .catch((err) => {
              console.error('[Auth Callback] poll error', err)
              if (isMounted) {
                setError(err?.message || 'Authentication failed. Please try signing in again.')
              }
            })
        }

        if (!hasQueryCode && !hasHashTokens) {
          pollForSession()
          return
        }

        let sessionError: { message: string } | null = null
        let finalSession = null

        if (hasQueryCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(url)
          sessionError = error ? { message: error.message } : null
          finalSession = data?.session ?? null
          console.log('[Auth Callback] exchangeCodeForSession result', { error, session: data?.session })
        } else if (hasHashTokens) {
          const params = new URLSearchParams(hash.replace(/^#/, ''))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          const { data, error: setError } = await supabase.auth.setSession({
            access_token: accessToken || '',
            refresh_token: refreshToken || '',
          })
          sessionError = setError ? { message: setError.message } : null
          finalSession = data?.session ?? null
          if (!setError) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          console.log('[Auth Callback] setSession result', { error: setError, session: data?.session })
        }

        if (sessionError) {
          console.error('Failed to process auth callback:', sessionError)
          if (isMounted) setError(sessionError.message)
          return
        }

        if (!finalSession) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          finalSession = session
          console.log('[Auth Callback] session after fallback getSession', session)
        }

        if (!finalSession) {
          pollForSession()
          return
        }

        await redirectToLevels()
        console.log('[Auth Callback] redirected with session', finalSession)
      } catch (err: any) {
        console.error('Unexpected error handling auth callback:', err)
        if (isMounted) {
          setError(err?.message || 'Authentication failed. Please try signing in again.')
        }
      }
    }

    handleCallback()

    return () => {
      isMounted = false
    }
  }, [refreshSession, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-800">Authentication Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => router.replace('/auth/signin')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
        <p className="text-gray-600">Completing sign-in…</p>
      </div>
    </div>
  )
}

