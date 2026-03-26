import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      try {
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1)
        if (existing.length === 0) {
          await db.insert(users).values({
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            role: 'user',
          })
        } else {
          await db.update(users)
            .set({ name: user.name ?? null, image: user.image ?? null })
            .where(eq(users.email, user.email))
        }
      } catch (e) {
        console.error('[auth] signIn error:', e)
        return false
      }
      return true
    },

    async jwt({ token, user }) {
      // Only hit the DB on the initial sign-in (when `user` is present)
      if (user?.email) {
        const dbUser = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1)
        if (dbUser[0]) {
          token.userId = dbUser[0].id
          token.role = dbUser[0].role ?? 'user'
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}
