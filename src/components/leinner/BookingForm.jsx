import { useState } from 'react'
import { supabase } from '../../lib/supabase'

function fmtSlot(slot) {
  const d = new Date(slot.date + 'T00:00:00')
  const date = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const [h, m] = slot.time.split(':')
  return `${date} · ${h}:${m} (${slot.duration_minutes} min)`
}

export default function BookingForm({ slot, onBack, onConfirmed, reviewerId, eventId }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [project, setProject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = name.trim() !== '' && email.trim() !== '' && project.trim() !== ''

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const { data, error: err } = await supabase.rpc('book_slot', {
      p_date: slot.date,
      p_time: slot.time,
      p_leinner_name: name.trim(),
      p_leinner_email: email.trim().toLowerCase(),
      p_leinner_project: project.trim(),
      ...(reviewerId ? { p_reviewer_id: reviewerId } : {}),
      ...(eventId ? { p_event_id: eventId } : {}),
    })

    setLoading(false)

    if (err || data?.error) {
      setError(data?.error ?? err.message)
      return
    }

    onConfirmed({ bookingId: data.booking_id, reviewerId: data.reviewer_id, name: name.trim(), email: email.trim().toLowerCase(), project: project.trim(), slot })
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <div>
        <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
          ← Back to slots
        </button>
        <h2 className="text-xl font-semibold text-gray-800">Confirm your booking</h2>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Selected slot</p>
        <p className="text-sm font-medium text-indigo-800 mt-0.5 capitalize">{fmtSlot(slot)}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">
            Proyecto al que perteneces <span className="text-red-500">*</span>
          </label>
          <input
            value={project}
            onChange={e => setProject(e.target.value)}
            placeholder="Nombre de tu proyecto"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error === 'No available slot at this time'
              ? 'This slot was just taken by someone else. Please go back and choose another.'
              : error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className={`font-medium rounded-lg px-4 py-2.5 text-sm transition-all
            ${canSubmit && !loading
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {loading ? 'Confirming…' : 'Confirm booking'}
        </button>
      </form>
    </div>
  )
}
