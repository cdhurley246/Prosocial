'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Nav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        Pro<span>social</span>
      </Link>
      <ul className="nav-links">
        <li>
          <Link href="/resources" style={pathname === '/resources' ? { color: 'var(--ink)' } : {}}>
            Resources
          </Link>
        </li>
        <li>
          <Link href="/browse" style={pathname === '/browse' ? { color: 'var(--ink)' } : {}}>
            Browse
          </Link>
        </li>
        <li>
          <Link href="/about" style={pathname === '/about' ? { color: 'var(--ink)' } : {}}>
            About
          </Link>
        </li>
      </ul>
      <p className="nav-disclaimer">Nothing on this page constitutes legal advice — please consult a lawyer</p>
      {status === 'loading' ? (
        <span className="nav-cta" style={{ opacity: 0.4 }}>…</span>
      ) : session ? (
        <div className="nav-auth">
          <Link href="/dashboard" className="nav-auth-name">
            {session.user?.name?.split(' ')[0] ?? 'Dashboard'}
          </Link>
          <button className="nav-signout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <button className="nav-cta" onClick={() => signIn('google')}>
          Sign in →
        </button>
      )}
    </nav>
  )
}
