import { Link } from 'react-router-dom'

const NotFound = () => {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
            <p className="label-xs">Error 404</p>
            <h1 className="text-2xl font-semibold text-content">Page not found</h1>
            <p className="max-w-md text-sm text-content-muted">
                The page you were looking for doesn&rsquo;t exist or has been moved.
            </p>
            <Link
                to="/tasks"
                className="mt-2 inline-flex h-9 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-contrast transition hover:bg-primary-hover"
            >
                Back to tasks
            </Link>
        </main>
    )
}

export default NotFound
