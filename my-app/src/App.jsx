import { Navigate, Route, Routes } from 'react-router-dom'

import Register from './components/Register'
import AuthProvider from './AuthProvider'
import PrivateRoute from './PrivateRoute'

import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import TaskDetailPage from './pages/TaskDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import GoalsPage from './pages/GoalsPage'
import GoalDetailPage from './pages/GoalDetailPage'
import HabitsPage from './pages/HabitsPage'
import PlannerPage from './pages/PlannerPage'
import CalendarPage from './pages/CalendarPage'
import FocusPage from './pages/FocusPage'
import AnalyticsPage from './pages/AnalyticsPage'
import NotFound from './pages/NotFound'

// One guard, applied per route, so a new page cannot be added without one by forgetting
// to wrap it.
const guarded = (element) => <PrivateRoute>{element}</PrivateRoute>

function App() {
    return (
        <AuthProvider>
            <Routes>
                {/* The auth screen. Everything below is behind PrivateRoute. */}
                <Route path="/" element={<Register />} />

                <Route path="/dashboard" element={guarded(<DashboardPage />)} />

                <Route path="/tasks" element={guarded(<TasksPage />)} />
                {/* The detail route sits before nothing else could shadow it; `:id` is the
                    only segment pattern in this tree. */}
                <Route path="/tasks/:id" element={guarded(<TaskDetailPage />)} />

                <Route path="/projects" element={guarded(<ProjectsPage />)} />
                <Route path="/projects/:id" element={guarded(<ProjectDetailPage />)} />

                <Route path="/goals" element={guarded(<GoalsPage />)} />
                <Route path="/goals/:id" element={guarded(<GoalDetailPage />)} />

                <Route path="/habits" element={guarded(<HabitsPage />)} />
                <Route path="/planner" element={guarded(<PlannerPage />)} />
                <Route path="/calendar" element={guarded(<CalendarPage />)} />
                <Route path="/focus" element={guarded(<FocusPage />)} />
                <Route path="/analytics" element={guarded(<AnalyticsPage />)} />

                {/*
                 * Legacy URLs from the pre-shell build. The create flow now lives in the
                 * tasks page's panel and the timer is a page of its own, so these redirect
                 * rather than 404 — a bookmark made last week should still land somewhere
                 * useful.
                 */}
                <Route path="/create-task" element={<Navigate to="/tasks" replace />} />
                <Route path="/timer" element={<Navigate to="/focus" replace />} />

                <Route path="*" element={<NotFound />} />
            </Routes>
        </AuthProvider>
    )
}

export default App
