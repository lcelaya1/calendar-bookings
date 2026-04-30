import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/shared/Navbar'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AdminPage from './pages/AdminPage'
import BookingPage from './pages/BookingPage'
import EventsPage from './pages/EventsPage'

function Layout() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <>
      {!isAdmin && <Navbar />}
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/book/:eventId" element={<BookingPage />} />
        <Route path="/book/:slug/:eventId" element={<BookingPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
