/* Client-side only SessionProvider wrapper */
"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { SessionProviderProps } from "next-auth/react"
import { useEffect, useState } from "react"

export function SessionProvider({ children, session }: SessionProviderProps) {
  const [mounted, setMounted] = useState(false)

  // Prevent server-side rendering of client-side only elements
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}
