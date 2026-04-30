import { useState } from 'react'
import ReviewerManager from '../components/admin/ReviewerManager'
import EventManager from '../components/admin/EventManager'
import BookingsList from '../components/admin/BookingsList'
import ConfigPanel from '../components/admin/ConfigPanel'

const NAV = [
  {
    id: 'Events',
    label: 'Events',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'Reviewers',
    label: 'Reviewers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'Bookings',
    label: 'Bookings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'Config',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function AdminPage({ adminUser, onSignOut }) {
  const [active, setActive] = useState('Events')

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-base font-bold text-indigo-600 tracking-tight">Booking Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active === item.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={active === item.id ? 'text-indigo-600' : 'text-gray-400'}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User */}
        {adminUser && (
          <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
            {adminUser.picture
              ? <img src={adminUser.picture} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-indigo-600">{adminUser.name?.[0]}</span>
                </div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 truncate">{adminUser.name}</p>
              <button
                onClick={onSignOut}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {active === 'Events'    && <EventManager />}
          {active === 'Reviewers' && (
            <Section title="Reviewers" subtitle="Manage the global pool of reviewers.">
              <ReviewerManager />
            </Section>
          )}
          {active === 'Bookings'  && (
            <Section title="Bookings" subtitle="All bookings across every event.">
              <BookingsList />
            </Section>
          )}
          {active === 'Config'    && (
            <Section title="Settings" subtitle="Global settings and calendar connection.">
              <ConfigPanel />
            </Section>
          )}
        </div>
      </main>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {children}
      </div>
    </div>
  )
}
