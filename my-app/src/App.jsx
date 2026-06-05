import { Routes, Route } from 'react-router-dom'
import Register from './components/Register'
import CreateTask from './components/CreateTask'

import AuthProvider from './AuthProvider'

import PrivateRoute from './PrivateRoute'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/create-task" element={<PrivateRoute><CreateTask /></PrivateRoute>} />
      </Routes>
    </AuthProvider>
  ) 
}

export default App
