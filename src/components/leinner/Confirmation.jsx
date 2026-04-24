function fmtSlot(slot) {
  const d = new Date(slot.date + 'T00:00:00')
  const date = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const [h, m] = slot.time.split(':')
  return `${date} · ${h}:${m} (${slot.duration_minutes} min)`
}

export default function Confirmation({ booking }) {
  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto text-center py-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-800">Booking confirmed!</h2>
        <p className="text-sm text-gray-400 mt-1">
          You'll receive a Google Calendar invite at <span className="font-medium text-gray-600">{booking.email}</span>.
        </p>
      </div>

      <div className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-left flex flex-col gap-2">
        <Row label="Name" value={booking.name} />
        <Row label="Slot" value={<span className="capitalize">{fmtSlot(booking.slot)}</span>} />
      </div>

      <p className="text-xs text-gray-400">
        The Google Meet link will be in your calendar invite.
      </p>

    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  )
}
