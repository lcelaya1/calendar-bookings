import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EventsPage() {
  const [events, setEvents] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('id, name, event_desc, duration_minutes, assignment_method')
        .eq('is_open', true)
        .order('created_at')
      const openEvents = data ?? []

      if (openEvents.length === 1) {
        navigate(`/book/${openEvents[0].id}`, { replace: true })
        return
      }

      setEvents(openEvents)
    }
    load()
  }, [navigate])

  if (events === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-gray-700">No events available</p>
          <p className="text-sm text-gray-400 mt-1">There are no open booking events right now. Check back later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-gray-800">Book a slot</h1>
          <p className="text-sm text-gray-400 mt-2">Choose the event you'd like to book a slot for.</p>
        </div>

        <div className="flex flex-col gap-4">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-800 truncate">{event.name}</h2>
                {event.event_desc && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{event.event_desc}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">{event.duration_minutes} min</span>
                  {event.assignment_method === 'language' && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">Language-based</span>
                  )}
                </div>
              </div>
              <Link
                to={`/book/${event.id}`}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                Book now
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
