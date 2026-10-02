import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import axiosInstance from '../axiosInstance'

const Register = () => {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [isLoginMode, setIsLoginMode] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    })
    const [isLoading, setIsLoading] = useState(false)

    const [errors, setErrors] = useState('')

   const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        })
   }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrors('')
        const payload = isLoginMode
            ? { username: formData.username, password: formData.password }
            : formData

        try {
            setIsLoading(true)
            const endpoint = isLoginMode ? '/auth/login' : '/auth/register'
            const response = await axiosInstance.post(endpoint, payload)

            // `login` stores the token and flips the auth flag, so the two can't drift.
            login(response.data.accessToken)
            navigate('/tasks')

        } catch (err) {
            const message =
                err.response?.data?.message ||
                err.message ||
                'Something went wrong'
            setErrors(message)
        } finally {
            setIsLoading(false)
        }

   }

   const handleModeChange = (nextMode) => {
        setIsLoginMode(nextMode)
        setShowPassword(false)
        setErrors('')
        setFormData({
            username: '',
            email: '',
            password: ''
        })
   }
    return (
        <>
            <main className="min-h-screen bg-background py-6 text-content">
                
                {/* header section */}
                <section className="flex w-full items-center justify-center gap-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-3xl font-black text-primary-contrast">P</div>
                        <div>
                            <p className="mt-2 text-2xl font-semibold tracking-wide text-content">
                                Planner
                            </p>
                            <p className="text-sm text-content-muted">
                                A calm space for your daily flow
                            </p>
                        </div>
                    </div>
                </section>


                <section className="mx-auto flex max-w-6xl items-center justify-center py-10">

                        <div className="flex px-6 py-10 md:px-10 md:py-12">
                            <div className="mx-auto flex w-full max-w-md flex-col justify-center text-center">
                                <div className="mx-auto inline-flex rounded-full border border-border bg-surface p-1 text-sm font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(false)}
                                        className={`rounded-full px-4 py-2 transition ${!isLoginMode ? 'bg-primary text-primary-contrast' : 'text-content-muted hover:text-content'}`}
                                    >
                                        Sign up
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(true)}
                                        className={`rounded-full px-4 py-2 transition ${isLoginMode ? 'bg-primary text-primary-contrast' : 'text-content-muted hover:text-content'}`}
                                    >
                                        Login
                                    </button>
                                </div>
                                <h2 className="mt-6 text-3xl font-semibold text-content">
                                    {isLoginMode ? 'Welcome back to Planner' : 'Start with a fresh workspace'}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-content-muted">
                                    {isLoginMode
                                        ? 'Sign in to continue where you left off and get back to your routine.'
                                        : 'Set up your account in a minute and begin planning with a cleaner rhythm.'}
                                </p>

                                <form className="mt-10 space-y-5 text-left" onSubmit={handleSubmit}>
                                    
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-content-muted" htmlFor="username">
                                                {isLoginMode ? 'Username or Email' : 'Username'}
                                            </label>
                                            <input
                                                className="w-full rounded-control border border-border-strong bg-surface-raised px-4 py-3 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                                id="username"
                                                type="text"
                                                value={formData.username}
                                                onChange={handleChange}
                                                placeholder={isLoginMode ? 'testuser or you@example.com' : 'testuser'}
                                            />
                                        </div>
                                    

                                    {!isLoginMode && (
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-content-muted" htmlFor="email">
                                            Email
                                        </label>
                                        <input
                                            className="w-full rounded-control border border-border-strong bg-surface-raised px-4 py-3 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    )}

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-content-muted" htmlFor="password">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                className="w-full rounded-control border border-border-strong bg-surface-raised px-4 py-3 pr-12 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Enter your password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((currentValue) => !currentValue)}
                                                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-control text-content-subtle transition hover:text-primary"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        {errors && <div className='text-danger text-sm font-medium'>{errors}</div>}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full rounded-control bg-primary px-4 py-3 font-semibold text-primary-contrast transition hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary-soft" 
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <LoaderCircle className="h-5 w-5 animate-spin" />
                                                {isLoginMode ? 'Signing in...' : 'Creating account...'}
                                            </span>
                                        ) : (
                                            isLoginMode ? 'login' : 'Create account'
                                        )}
                                    </button>
                                </form>

                                <div className="my-6 flex items-center gap-2 text-sm font-semibold text-content-subtle">
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="px-3 py-1 text-content-subtle">
                                        or
                                    </span>
                                    <div className="h-px flex-1 bg-border" />
                                </div>
                                

                                <p className="text-center text-sm text-content-muted">
                                    {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(!isLoginMode)}
                                        className="font-semibold text-primary transition hover:text-primary-hover"
                                    >
                                        {isLoginMode ? 'Sign up' : 'Login'}
                                    </button>
                                </p>
                            </div>
                        </div>
                </section>
            </main>
        </>
    )
}

export default Register
