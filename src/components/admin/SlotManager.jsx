import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(timeStr) {
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

function generateSlots(startTime, endTime, durationMin, breakMin) {
  const slots = []
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let current = sh * 60 + sm
  const end = eh * 60 + em
  const step = durationMin + breakMin

  while (current + durationMin <= end) {
    const h = String(Math.floor(current / 60)).padStart(2, '0')
    const m = String(current % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += step
  }
  return slots
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

export default function SlotManager() {
  const [reviewers, setReviewers] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState([])

  const [reviewerId, setReviewerId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [breakTime, setBreakTime] = useState(10)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (date && startTime && endTime && toMinutes(startTime) < toMinutes(endTime)) {
      setPreview(generateSlots(startTime, endTime, Number(duration), Number(breakTime)))
    } else {
      setPreview([])
    }
  }, [date, startTime, endTime, duration, breakTime])

  async function load() {
    setLoading(true)
    const [{ data: revs }, { data: slts }] = await Promise.all([
      supabase.from('reviewers').select('*').order('name'),
      supabase.from('slots').select('*, reviewers(name)').order('date').order('time'),
    ])
    setReviewers(revs ?? [])
    setSlots(slts ?? [])
    if (revs?.length) setReviewerId(prev => prev || revs[0].id)
    setLoading(false)
  }

  async function addSlots(e) {
    e.preventDefault()
    setError('')
    if (preview.length === 0) { setError('No slots to generate — check your times.'); return }
    setSaving(true)

    const rows = preview.map(t => ({
      reviewer_id: reviewerId,
      date,
      time: t,
      duration_minutes: Number(duration),
    }))

    const { error: err } = await supabase.from('slots').upsert(rows, { onConflict: 'reviewer_id,date,time', ignoreDuplicates: true })
    setSaving(false)
    if (err) { setError(err.message); return }

    setDate('')
    setStartTime('')
    setEndTime('')
    load()
  }

  async function removeSlot(slot) {
    if (slot.booked) { setError('Cannot remove a booked slot.'); return }
    setError('')
    const { error: bookingErr } = await supabase.from('bookings').delete().eq('slot_id', slot.id)
    if (bookingErr) { setError(`Failed to remove slot: ${bookingErr.message}`); return }
    const { error: slotErr } = await supabase.from('slots').delete().eq('id', slot.id)
    if (slotErr) { setError(`Failed to remove slot: ${slotErr.message}`); return }
    load()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (reviewers.length === 0)
    return <p className="text-sm text-gray-400">Add reviewers first before creating slots.</p>

  const grouped = reviewers.map(r => ({
    reviewer: r,
    slots: slots.filter(s => s.reviewer_id === r.id),
  }))

  const durationOptions = [15, 20, 30, 45, 60, 90]
  const breakOptions = [0, 5, 10, 15, 20, 30]

  return (
    <div className="flex flex-col gap-8">
      {/* Generator form */}
      <form onSubmit={addSlots} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-700">Generate slots</h3>

        <div className="flex flex-col gap-3">
          {/* Row 1: Reviewer full width */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Reviewer</label>
            <select
              value={reviewerId}
              onChange={e => setReviewerId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {reviewers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {/* Row 2: Date, Start time, End time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Date</label>
              <input
                required type="date" value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Start time</label>
              <select
                required value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">--:--</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">End time</label>
              <select
                required value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">--:--</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Slot duration + Break */}
          <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Slot duration</label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {durationOptions.map(m => (
                <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60}h`}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Break between slots</label>
            <select
              value={breakTime}
              onChange={e => setBreakTime(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {breakOptions.map(m => (
                <option key={m} value={m}>{m === 0 ? 'No break' : `${m} min`}</option>
              ))}
            </select>
          </div>
          </div>
        </div>

        {/* Live preview */}
        {preview.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">
              {preview.length} slot{preview.length !== 1 ? 's' : ''} will be created
            </p>
            <div className="flex flex-wrap gap-2">
              {preview.map(t => (
                <span key={t} className="bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-lg px-2.5 py-1">
                  {fmtTime(t)}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div>
          <button
            type="submit"
            disabled={saving || preview.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-5 py-2 transition-colors"
          >
            {saving ? 'Creating…' : `Create ${preview.length > 0 ? preview.length : ''} slot${preview.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>

      {/* Slots by reviewer */}
      <div className="flex flex-col gap-6 border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-700">All slots</h3>
        {grouped.every(g => g.slots.length === 0) ? (
          <p className="text-sm text-gray-400">No slots yet.</p>
        ) : grouped.map(({ reviewer, slots: rSlots }) => rSlots.length === 0 ? null : (
          <div key={reviewer.id}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{reviewer.name}</h4>
            <div className="flex flex-col gap-1">
              {rSlots.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 font-medium">{fmtDate(s.date)}</span>
                    <span className="text-sm text-gray-500">{fmtTime(s.time)}</span>
                    <span className="text-xs text-gray-400">{s.duration_minutes} min</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.booked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.booked ? 'Booked' : 'Available'}
                    </span>
                  </div>
                  {!s.booked && (
                    <button onClick={() => removeSlot(s)} className="text-red-400 hover:text-red-600 text-xs transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
