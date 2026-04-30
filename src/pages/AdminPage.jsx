import { useState } from 'react'
import ReviewerManager from '../components/admin/ReviewerManager'
import EventManager from '../components/admin/EventManager'
import BookingsList from '../components/admin/BookingsList'
import ConfigPanel from '../components/admin/ConfigPanel'

const tabs = ['Events', 'Reviewers', 'Bookings', 'Config']

export default function AdminPage({ adminUser, onSignOut }) {
  const [activeTab, setActiveTab] = useState('Events')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Admin Panel</h1>
          {adminUser && (
            <div className="flex items-center gap-3">
              {adminUser.picture && (
                <img src={adminUser.picture} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700 leading-tight">{adminUser.name}</p>
                <p className="text-xs text-gray-400">{adminUser.email}</p>
              </div>
              <button
                onClick={onSignOut}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className={activeTab === 'Events' ? '' : 'bg-white rounded-xl border border-gray-200 shadow-sm p-6'}>
          {activeTab === 'Events' && <EventManager />}
          {activeTab === 'Reviewers' && <ReviewerManager />}
          {activeTab === 'Bookings' && <BookingsList />}
          {activeTab === 'Config' && <ConfigPanel />}
        </div>
      </div>
    </div>
  )
}
