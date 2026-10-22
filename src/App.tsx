import { NavLink, Outlet, RouterProvider, createHashRouter } from 'react-router-dom'
import { useActiveSession, useSettings } from './db/hooks'
import RecordsPage from './features/records/RecordsPage'
import { Onboarding } from './features/settings/Onboarding'
import SettingsPage from './features/settings/SettingsPage'
import TimerPage from './features/timer/TimerPage'
import TodayPage from './features/today/TodayPage'
import WorkoutPage from './features/workout/WorkoutPage'

const NAV = [
  { to: '/', label: '오늘', icon: '◎' },
  { to: '/workout', label: '운동', icon: '▲' },
  { to: '/timer', label: '타이머', icon: '◷' },
  { to: '/records', label: '기록', icon: '≡' },
  { to: '/settings', label: '설정', icon: '⚙︎' },
]

function Layout() {
  const settings = useSettings()
  const active = useActiveSession()
  const inProgress = active !== 'loading' && !!active

  return (
    <>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {NAV.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `relative flex flex-col items-center py-2 text-xs ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                <span className="text-lg leading-6">{n.icon}</span>
                {n.label}
                {n.to === '/workout' && inProgress && <span className="absolute right-[30%] top-1.5 h-2 w-2 rounded-full bg-bad" />}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {settings && !settings.disclaimerAcceptedAt && <Onboarding />}
    </>
  )
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TodayPage /> },
      { path: '/workout', element: <WorkoutPage /> },
      { path: '/timer', element: <TimerPage /> },
      { path: '/records', element: <RecordsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
