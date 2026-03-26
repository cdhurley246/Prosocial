import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <>
      <Nav />
      <main className="dashboard">
        <div className="dashboard-header">
          <p className="kicker">Your Account</p>
          <h1>{session.user?.name}</h1>
          <p className="dashboard-email">{session.user?.email}</p>
        </div>
        <div className="dashboard-sections">
          <section className="dashboard-section">
            <h2>Saved Results</h2>
            <p className="dashboard-empty">
              Your saved chatbot match results will appear here. After a chat session,
              you&apos;ll be able to save orgs and resources you want to revisit.
            </p>
          </section>
          <section className="dashboard-section">
            <h2>Saved Resources</h2>
            <p className="dashboard-empty">
              Resources and documents you&apos;ve bookmarked across the platform will
              show up here for easy access.
            </p>
          </section>
          <section className="dashboard-section">
            <h2>Submit Resources</h2>
            <p className="dashboard-empty">
              Share your organization&apos;s bylaws, templates, or guides with the
              platform to help other nonprofits and co-ops.
            </p>
          </section>
          <section className="dashboard-section">
            <h2>Your Organization</h2>
            <p className="dashboard-empty">
              Connect your organization to your account to manage your profile and
              submitted resources.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
