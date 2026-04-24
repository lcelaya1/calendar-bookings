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
    const { error: err } = await supabase.from('reviewers').insert({ name: name.trim(), email: email.trim().toLowerCase() })
    setSaving(false)
    if (err) {
      setError(err.message.includes('unique') ? 'That email is already registered.' : err.message)
      return
    }
    setName('')
    setEmail('')
    load()
  }

  async function removeReviewer(reviewer) {
    if ((bookingCounts[reviewer.id] ?? 0) > 0) {
      setError(`Cannot remove ${reviewer.name} — they have confirmed bookings.`)
      return
    }
    setError('')
    await supabase.from('reviewers').delete().eq('id', reviewer.id)
    load()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
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
                <td className="py-3 text-gray-800 font-medium">{r.name}</td>
                <td className="py-3 text-gray-500">{r.email}</td>
                <td className="py-3 text-center">
                  <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full px-2 py-0.5">
                    {bookingCounts[r.id] ?? 0}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => removeReviewer(r)}
                    className="text-red-400 hover:text-red-600 text-xs transition-colors"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
