import { Routes, Route } from 'react-router-dom'
import Register from './components/Register'
import CreateTask from './components/CreateTask'

import AuthProvider from './AuthProvider'
import PrivateRoute from './PrivateRoute'

import PomodoroTimer from './components/PomodoroTimer'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/create-task" element={<PrivateRoute><CreateTask /></PrivateRoute>} />
        <Route path="/timer" element={<PrivateRoute><PomodoroTimer /></PrivateRoute>} />
      </Routes>
    </AuthProvider>
  ) 
}

export default App
