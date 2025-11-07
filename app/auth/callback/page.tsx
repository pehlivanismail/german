'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabaseClient, useAuth } from '@/lib/auth-supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let unsubscribe: (() => void) | null = null

    const redirectToLevels = async () => {
      if (!isMounted || hasRedirected) return
      setHasRedirected(true)
      try {
        await refreshSession()
      } catch (refreshError) {
        console.error('[Auth Callback] refreshSession error', refreshError)
      }
      window.location.href = '/levels'
    }

    const handleCallback = async () => {
      try {
        const supabase = getBrowserSupabaseClient()

        const url = window.location.href
        const hash = window.location.hash || ''
        const hasQueryCode = url.includes('code=')
        const hasHashTokens = /access_token=/.test(hash)

        if (hasQueryCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(url)
          if (error) throw error
          await redirectToLevels()
          return
        }

        if (hasHashTokens) {
          const params = new URLSearchParams(hash.replace(/^#/, ''))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          const { error } = await supabase.auth.setSession({
            access_token: accessToken || '',
            refresh_token: refreshToken || '',
          })

          if (error) throw error
          window.history.replaceState(null, '', window.location.pathname)
          await redirectToLevels()
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          await redirectToLevels()
          return
        }

        const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession) {
            redirectToLevels()
          }
        })

        unsubscribe = () => data.subscription.unsubscribe()

        timeoutId = setTimeout(() => {
          if (!hasRedirected) {
            redirectToLevels()
          }
        }, 2000)
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
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [hasRedirected, refreshSession])

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

