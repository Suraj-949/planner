import { formatDateKey } from '../utils/dates'

/*
 * Streak is derived from the shared day key rather than its own date maths, so a day
 * boundary means the same thing here as it does in the reminder logic.
 */
const updateStreak = () => {
    const streak = Number(localStorage.getItem('streak')) || 0
    const lastCompletedDate = localStorage.getItem('lastCompletedDate')
    const today = formatDateKey(new Date())

    if (!lastCompletedDate) {
        localStorage.setItem('streak', '1')
        localStorage.setItem('lastCompletedDate', today)
        return 1
    }

    const lastDate = formatDateKey(lastCompletedDate)
    const todayDate = new Date(`${today}T00:00:00`)
    const previousDate = new Date(`${lastDate}T00:00:00`)
    const diffDays = (todayDate - previousDate) / (1000 * 60 * 60 * 24)

    if (diffDays === 0) {
        return streak
    }

    const newStreak = diffDays === 1 ? streak + 1 : 1

    localStorage.setItem('streak', String(newStreak))
    localStorage.setItem('lastCompletedDate', today)

    return newStreak
}

export default updateStreak
