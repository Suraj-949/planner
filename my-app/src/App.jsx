import { Routes, Route } from 'react-router-dom'
import Register from './components/Register'
import TasksPage from './pages/TasksPage'
import CreateTask from './components/CreateTask'
import PomodoroTimer from './components/PomodoroTimer'
import NotFound from './pages/NotFound'

import AuthProvider from './AuthProvider'
import PrivateRoute from './PrivateRoute'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route
          path="/tasks"
          element={
            <PrivateRoute>
              <TasksPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/create-task"
          element={
            <PrivateRoute>
              <CreateTask />
            </PrivateRoute>
          }
        />
        <Route
          path="/timer"
          element={
            <PrivateRoute>
              <PomodoroTimer />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
