import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createCalendarEvent } from '../lib/calendarApi'
import { extractMeetLink } from '../lib/google'
import SlotPicker from '../components/leinner/SlotPicker'
import BookingForm from '../components/leinner/BookingForm'
import Confirmation from '../components/leinner/Confirmation'

export default function BookingPage() {
  const [bookingsOpen, setBookingsOpen] = useState(null)
  const [step, setStep] = useState('pick') // 'pick' | 'form' | 'confirmed'
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [confirmedBooking, setConfirmedBooking] = useState(null)

  useEffect(() => {
    supabase
      .from('config')
      .select('bookings_open')
      .eq('id', 1)
      .single()
      .then(({ data }) => setBookingsOpen(data?.bookings_open ?? false))
  }, [])

  async function handleConfirmed(booking) {
    // Show confirmation immediately — don't block on Calendar API
    setConfirmedBooking(booking)
    setStep('confirmed')

    try {
      const [{ data: config }, { data: reviewer }] = await Promise.all([
        supabase.from('config').select('event_desc').eq('id', 1).single(),
        supabase.from('reviewers').select('email, name').eq('id', booking.reviewerId).single(),
      ])

      const reviewerFirstName = reviewer.name.split(' ')[0].toUpperCase()
      const eventTitle = `[ONLINE] ${reviewerFirstName} - CANDIDATURA SUP (${booking.name})`

      const event = await createCalendarEvent({
        title: eventTitle,
        description: config?.event_desc || '',
        date: booking.slot.date,
        time: booking.slot.time,
        durationMinutes: booking.slot.duration_minutes,
        reviewerEmail: reviewer.email,
        leinnerEmail: booking.email,
        leinnerName: `${booking.name} — ${booking.project}`,
      })

      const meetLink = extractMeetLink(event)

      await supabase.from('bookings').update({
        google_event_id: event.id,
        google_meet_link: meetLink ?? '',
      }).eq('id', booking.bookingId)

      if (meetLink) {
        setConfirmedBooking(prev => ({ ...prev, meetLink }))
      }
    } catch (err) {
      // Booking is confirmed — Calendar failure is non-fatal
      console.error('Google Calendar error:', err.message)
    }
  }

  if (bookingsOpen === null)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )

  if (!bookingsOpen)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-gray-700">Bookings are closed</p>
          <p className="text-sm text-gray-400 mt-1">Slot booking is not available right now. Check back later.</p>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`mx-auto px-6 py-10 ${step === 'pick' ? 'max-w-4xl' : 'max-w-lg'}`}>
        {step === 'pick' && (
          <SlotPicker onSelect={slot => { setSelectedSlot(slot); setStep('form') }} />
        )}
        {step === 'form' && (
          <BookingForm
            slot={selectedSlot}
            onBack={() => setStep('pick')}
            onConfirmed={handleConfirmed}
          />
        )}
        {step === 'confirmed' && (
          <Confirmation booking={confirmedBooking} />
        )}
      </div>
    </div>
  )
}
