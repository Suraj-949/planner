const formatDateKey = (date) => {
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)

    const year = normalizedDate.getFullYear()
    const month = String(normalizedDate.getMonth() + 1).padStart(2, '0')
    const day = String(normalizedDate.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

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