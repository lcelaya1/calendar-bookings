import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ReviewerManager() {
  const [reviewers, setReviewers] = useState([])
  const [bookingCounts, setBookingCounts] = useState({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null) // reviewer object to confirm

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: revs }, { data: bookings }] = await Promise.all([
      supabase.from('reviewers').select('*').order('created_at'),
      supabase.from('bookings').select('reviewer_id'),
    ])
    setReviewers(revs ?? [])
    const counts = {}
    for (const b of bookings ?? []) {
      counts[b.reviewer_id] = (counts[b.reviewer_id] ?? 0) + 1
    }
    setBookingCounts(counts)
    setLoading(false)
  }

  async function addReviewer(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('reviewers').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
    })
    setSaving(false)
    if (err) {
      setError(err.message.includes('unique') ? 'That email is already registered.' : err.message)
      return
    }
    setName('')
    setEmail('')
    load()
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditName(r.name)
    setEditEmail(r.email)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setError('')
  }

  async function saveEdit(id) {
    setError('')
    const { error: err } = await supabase
      .from('reviewers')
      .update({ name: editName.trim(), email: editEmail.trim().toLowerCase() })
      .eq('id', id)
    if (err) {
      setError(err.message.includes('unique') ? 'That email is already registered.' : err.message)
      return
    }
    setEditingId(null)
    load()
  }

  function removeReviewer(reviewer) {
    setError('')
    setConfirmRemove(reviewer)
  }

  async function confirmDelete() {
    const reviewer = confirmRemove
    setConfirmRemove(null)
    setError('')

    // Cascade: delete bookings → slots → reviewer
    const { data: slots } = await supabase.from('slots').select('id').eq('reviewer_id', reviewer.id)
    if (slots?.length) {
      const slotIds = slots.map(s => s.id)
      await supabase.from('bookings').delete().in('slot_id', slotIds)
    }
    await supabase.from('slots').delete().eq('reviewer_id', reviewer.id)
    const { error: err } = await supabase.from('reviewers').delete().eq('id', reviewer.id)
    if (err) { setError(err.message); return }
    load()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-6">

      {/* Confirm-delete modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-gray-900">¿Eliminar a {confirmRemove.name}?</p>
              {(bookingCounts[confirmRemove.id] ?? 0) > 0 ? (
                <p className="text-sm text-gray-500">
                  Este revisor tiene{' '}
                  <span className="font-semibold text-red-600">{bookingCounts[confirmRemove.id]} reserva{bookingCounts[confirmRemove.id] !== 1 ? 's' : ''}</span>{' '}
                  confirmada{bookingCounts[confirmRemove.id] !== 1 ? 's' : ''}. Al eliminarlo se borrarán también todos sus slots y reservas asociadas. Esta acción no se puede deshacer.
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Se eliminarán también todos sus slots. Esta acción no se puede deshacer.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={addReviewer} className="flex flex-col sm:flex-row gap-3">
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Full name"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          required
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 whitespace-nowrap transition-colors"
        >
          {saving ? 'Adding…' : 'Add reviewer'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {reviewers.length === 0 ? (
        <p className="text-sm text-gray-400">No reviewers yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium text-center">Bookings</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {reviewers.map(r => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                {editingId === r.id ? (
                  <>
                    <td className="py-2 pr-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full px-2 py-0.5">
                        {bookingCounts[r.id] ?? 0}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => saveEdit(r.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 text-gray-800 font-medium">{r.name}</td>
                    <td className="py-3 text-gray-500">{r.email}</td>
                    <td className="py-3 text-center">
                      <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full px-2 py-0.5">
                        {bookingCounts[r.id] ?? 0}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-indigo-500 hover:text-indigo-700 text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeReviewer(r)}
                          className="text-red-400 hover:text-red-600 text-xs transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
