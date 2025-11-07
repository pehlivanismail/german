'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient, type Session, type User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Auth features will not work correctly.')
}

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (typeof window !== 'undefined' && supabase) {
  ;(window as any).supabase = supabase
}

export function getBrowserSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
  return supabase
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  getSessionToken: () => Promise<string | null>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const loadInitialSession = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return

    loadInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadInitialSession])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      signUp: async (email: string, password: string) => {
        if (!supabase) throw new Error('Supabase is not configured')
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      },
      signIn: async (email: string, password: string) => {
        if (!supabase) throw new Error('Supabase is not configured')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signInWithGoogle: async () => {
        if (!supabase) throw new Error('Supabase is not configured')
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: origin
            ? {
                redirectTo: `${origin}/levels`,
              }
            : undefined,
        })
        if (error) throw error
      },
      signOut: async () => {
        if (!supabase) throw new Error('Supabase is not configured')
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setUser(null)
          return
        }

        const { error } = await supabase.auth.signOut()
        if (error && error.message !== 'Auth session missing!') throw error
        setUser(null)
      },
      getSessionToken: async () => {
        if (!supabase) throw new Error('Supabase is not configured')
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session?.access_token ?? null
      },
      refreshSession: async () => {
        if (!supabase) throw new Error('Supabase is not configured')
        setLoading(true)
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        setLoading(false)
      },
    }
  }, [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

