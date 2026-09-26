import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { RoomPage } from '@/pages/room-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { LandingPage } from '@/pages/landing-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { SignInPage, SignUpPage } from '@/pages/auth-pages'

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/room/:code', element: <RoomPage /> },
  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  return <RouterProvider router={router} />
}
