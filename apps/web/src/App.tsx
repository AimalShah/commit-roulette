import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'

import { RoomPage } from '@/pages/room-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { LandingPage } from '@/pages/landing-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { SignInPage, SignUpPage } from '@/pages/auth-pages'

/**
 * Hosting needs an account. Joining a room does not, so `/room/:code` and the
 * landing page stay public.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) return null
  if (!isSignedIn) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirect)}`} replace />
  }

  return children
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/sign-in/*', element: <SignInPage /> },
  { path: '/sign-up/*', element: <SignUpPage /> },
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
  { path: '/room/:code', element: <RoomPage /> },
  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  return <RouterProvider router={router} />
}
