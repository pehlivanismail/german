import { getSupabaseAdmin } from './supabase-admin'

export async function getUserIdFromRequest(authHeader: string | null): Promise<string | null> {
  if (!authHeader) {
    return null
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return null
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.getUser(token)
    if (error) {
      console.error('Failed to validate Supabase token:', error)
      return null
    }
    return data.user?.id ?? null
  } catch (error) {
    console.error('Error verifying Supabase token:', error)
    return null
  }
}

