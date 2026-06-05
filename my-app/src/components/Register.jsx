import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../AuthProvider'
import axiosInstance from '../axiosInstance'

const Register = () => {
    const navigate = useNavigate()
    const { setIsAuthenticated } = useContext(AuthContext)
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

            console.log(`${isLoginMode ? 'Login' : 'Registration'} successful:`, response.data);
            
            // Save the access token for protected requests after either auth action succeeds.
            if (response.data.accessToken) {
                localStorage.setItem('accessToken', response.data.accessToken)
                setIsAuthenticated(true)
            }
            navigate('/create-task')

        } catch (err) {
            const message =
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Something went wrong'
            setErrors(message)
            console.error(`${isLoginMode ? 'Login' : 'Registration'} error:`, err.response?.data || err.message);
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
            <main className="  py-6 text-stone-900">
                
                {/* header section */}
                <section className=" flex w-full items-center justify-left gap-4 px-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center font-serif justify-center rounded-2xl border border-emerald-900/20 bg-emerald-200 text-3xl font-black text-emerald-950 shadow-sm">P</div>
                        <div>
                            <p className="font-serif mt-2 text-2xl font-semibold tracking-wide">
                                Planner
                            </p>
                            <p className="text-sm text-stone-600">
                                A calm space for your daily flow
                            </p>
                        </div>
                    </div>
                </section>


                <section className="mx-auto flex max-w-6xl items-center justify-center py-10">

                        <div className="flex px-6 py-10 md:px-10 md:py-12">
                            <div className="mx-auto flex w-full max-w-md flex-col justify-center text-center">
                                <div className="mx-auto inline-flex rounded-full bg-stone-100 p-1 text-sm font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(false)}
                                        className={`rounded-full px-4 py-2 transition ${!isLoginMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                    >
                                        Sign up
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(true)}
                                        className={`rounded-full px-4 py-2 transition ${isLoginMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                    >
                                        Login
                                    </button>
                                </div>
                                <h2 className="mt-3 font-serif text-3xl font-semibold text-stone-900">
                                    {isLoginMode ? 'Welcome back to Planner' : 'Start with a fresh workspace'}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-stone-600">
                                    {isLoginMode
                                        ? 'Sign in to continue where you left off and get back to your routine.'
                                        : 'Set up your account in a minute and begin planning with a cleaner rhythm.'}
                                </p>

                                <form className="mt-10 space-y-5 text-left" onSubmit={handleSubmit}>
                                    
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="username">
                                                {isLoginMode ? 'Username or Email' : 'Username'}
                                            </label>
                                            <input
                                                className="w-full rounded-2xl border border-stone-600 bg-stone-50 px-4 py-3 text-stone-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                                id="username"
                                                type="text"
                                                value={formData.username}
                                                onChange={handleChange}
                                                placeholder={isLoginMode ? 'testuser or you@example.com' : 'testuser'}
                                            />
                                        </div>
                                    

                                    {!isLoginMode && (
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="email">
                                            Email
                                        </label>
                                        <input
                                            className="w-full rounded-2xl border border-stone-600 bg-stone-50 px-4 py-3 text-stone-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    )}

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="password">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                className="w-full rounded-2xl border border-stone-600 bg-stone-50 px-4 py-3 pr-12 text-stone-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Enter your password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((currentValue) => !currentValue)}
                                                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        {errors && <div className='text-red-600 text-sm font-medium'>{errors}</div>}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full rounded-2xl bg-stone-900 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200" 
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

                                <div className="my-6 flex items-center gap-2s text-md font-semibold text-stone-400">
                                    <div className="h-px flex-1 bg-stone-300" />
                                    <span className=" px-3 py-1  text-stone-500">
                                        or
                                    </span>
                                    <div className="h-px flex-1 bg-stone-300" />
                                </div>
                                

                                <p className="text-center text-sm text-stone-500">
                                    {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange(!isLoginMode)}
                                        className="font-semibold text-stone-800 transition hover:text-emerald-700"
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
