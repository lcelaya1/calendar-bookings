import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { detectCanceller } from '../../lib/google'
import { deleteCalendarEvent, getCalendarEvent } from '../../lib/calendarApi'

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
  const [cancelling, setCancelling] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [detecting, setDetecting] = useState(null)   // booking id currently being detected
  const [detected, setDetected] = useState({})        // { [bookingId]: 'leinner' | 'reviewer' | 'admin' | null }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, reviewers(name, email)')
      .order('date')
      .order('time')
    setBookings(data ?? [])
    setLoading(false)
  }

  async function handleCancelClick(booking) {
    setDetecting(booking.id)
    try {
      let who = null
      if (booking.google_event_id) {
        const { data: config } = await supabase.from('config').select('ops_email').eq('id', 1).single()
        const event = await getCalendarEvent(booking.google_event_id)
        who = detectCanceller(event, booking.leinner_email, booking.reviewers?.email, config?.ops_email)
      }
      setDetected(prev => ({ ...prev, [booking.id]: who }))
    } catch {
      setDetected(prev => ({ ...prev, [booking.id]: undefined }))
    } finally {
      setDetecting(null)
      setConfirmId(booking.id)
    }
  }

  async function cancelBooking(booking, cancelledBy) {
    setCancelling(booking.id)
    setConfirmId(null)
    setDetected(prev => { const n = { ...prev }; delete n[booking.id]; return n })

    await Promise.all([
      supabase.from('bookings').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
      }).eq('id', booking.id),
      supabase.from('slots').update({ booked: false }).eq('id', booking.slot_id),
      booking.google_event_id
        ? deleteCalendarEvent(booking.google_event_id).catch(err => console.warn('Calendar delete:', err.message))
        : Promise.resolve(),
    ])

    setCancelling(null)
    load()
  }

  const confirmed = bookings.filter(b => (b.status ?? 'confirmed') === 'confirmed')
  const cancelled = bookings.filter(b => b.status === 'cancelled')

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {confirmed.length} confirmed · {cancelled.length} cancelled
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
                      {confirmId === b.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          {detected[b.id] != null ? (
                            <>
                              <span className="text-xs text-gray-500 font-medium">
                                Detected: cancelled by{' '}
                                <span className="font-semibold text-gray-700">
                                  {detected[b.id] === 'leinner' ? 'LEINNer' : detected[b.id] === 'reviewer' ? 'Reviewer' : 'Admin'}
                                </span>
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => cancelBooking(b, detected[b.id])}
                                  disabled={cancelling === b.id}
                                  className="text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDetected(prev => ({ ...prev, [b.id]: undefined }))}
                                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  Override
                                </button>
                                <button
                                  onClick={() => { setConfirmId(null); setDetected(prev => { const n = { ...prev }; delete n[b.id]; return n }) }}
                                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500 font-medium">Who cancelled?</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => cancelBooking(b, 'admin')}
                                  disabled={cancelling === b.id}
                                  className="text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                                >
                                  Me (admin)
                                </button>
                                <button
                                  onClick={() => cancelBooking(b, 'reviewer')}
                                  disabled={cancelling === b.id}
                                  className="text-xs font-medium bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                                >
                                  Reviewer
                                </button>
                                <button
                                  onClick={() => cancelBooking(b, 'leinner')}
                                  disabled={cancelling === b.id}
                                  className="text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                                >
                                  LEINNer
                                </button>
                                <button
                                  onClick={() => { setConfirmId(null); setDetected(prev => { const n = { ...prev }; delete n[b.id]; return n }) }}
                                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCancelClick(b)}
                          disabled={detecting === b.id}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                        >
                          {detecting === b.id ? 'Detecting…' : 'Cancel'}
                        </button>
                      )}
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
