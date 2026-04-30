import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { detectCanceller } from '../../lib/google'
import { getCalendarEvent } from '../../lib/calendarApi'

function fmt(date, time) {
  const d = new Date(`${date}T${time}`)
  return d.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function exportCSV(bookings) {
  const header = 'LEINNer name,LEINNer email,Project,Date & time,Reviewer name,Reviewer email,Status,Cancelled at'
  const rows = bookings.map(b =>
    [
      b.leinner_name, b.leinner_email, b.leinner_project ?? '',
      fmt(b.date, b.time), b.reviewers?.name ?? '', b.reviewers?.email ?? '',
      b.status ?? 'confirmed',
      b.cancelled_at ? new Date(b.cancelled_at).toLocaleString('es-ES') : '',
    ]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bookings.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BookingsList() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, reviewers(name, email)')
      .order('date')
      .order('time')
    const bookings = data ?? []
    setBookings(bookings)
    setLoading(false)
    syncCancellations(bookings)
  }

  async function syncCancellations(bookings) {
    setSyncing(true)
    const { data: config } = await supabase.from('config').select('ops_email').eq('id', 1).single()
    const confirmed = bookings.filter(b => (b.status ?? 'confirmed') === 'confirmed' && b.google_event_id)

    for (const booking of confirmed) {
      try {
        const event = await getCalendarEvent(booking.google_event_id)
        const who = detectCanceller(event, booking.leinner_email, booking.reviewers?.email, config?.ops_email)
        if (who) {
          await Promise.all([
            supabase.from('bookings').update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: who,
            }).eq('id', booking.id),
            supabase.from('slots').update({ booked: false }).eq('id', booking.slot_id),
          ])
        }
      } catch {
        // ignore individual errors
      }
    }

    const { data: fresh } = await supabase
      .from('bookings')
      .select('*, reviewers(name, email)')
      .order('date')
      .order('time')
    setBookings(fresh ?? [])
    setSyncing(false)
  }

  const confirmed = bookings.filter(b => (b.status ?? 'confirmed') === 'confirmed')
  const cancelled = bookings.filter(b => b.status === 'cancelled')

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {confirmed.length} confirmed · {cancelled.length} cancelled
          {syncing && <span className="ml-2 text-gray-400">· Syncing…</span>}
        </p>
        {bookings.length > 0 && (
          <button
            onClick={() => exportCSV(bookings)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400">No bookings yet.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Confirmed */}
          {confirmed.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Confirmed</h3>
              <div className="flex flex-col gap-2">
                {confirmed.map(b => (
                  <div key={b.id} className="flex items-start justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 gap-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{b.leinner_name}</span>
                        {b.leinner_project && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{b.leinner_project}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{b.leinner_email}</span>
                      <span className="text-xs text-gray-500 mt-1">{fmt(b.date, b.time)} · {b.reviewers?.name ?? '—'}</span>
                    </div>

                    <div className="shrink-0">
                      <span className="text-xs text-green-600 font-medium">Confirmed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cancelled</h3>
              <div className="flex flex-col gap-2">
                {cancelled.map(b => (
                  <div key={b.id} className="flex items-start justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 gap-4 opacity-60">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 line-through">{b.leinner_name}</span>
                        {b.leinner_project && (
                          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{b.leinner_project}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{b.leinner_email}</span>
                      <span className="text-xs text-gray-400 mt-1">{fmt(b.date, b.time)} · {b.reviewers?.name ?? '—'}</span>
                      {b.cancelled_at && (
                        <span className="text-xs text-gray-400 mt-0.5">
                          Cancelled by <span className="font-medium">{b.cancelled_by === 'leinner' ? 'LEINNer' : b.cancelled_by === 'reviewer' ? 'Reviewer' : 'Admin'}</span>
                          {' · '}{new Date(b.cancelled_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-red-400 shrink-0">Cancelled</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
