/*
 * Ambient sound for Focus Mode — generated, not streamed.
 *
 * A looping low-passed brown-noise buffer stands in for rain: it exists entirely offline,
 * so there is no asset URL to fail, and the toggle never claims playback it did not get —
 * `startAmbient` resolves false whenever the Web Audio API is missing or the context
 * refuses to resume, and the caller keeps its "off" state in that case.
 */

let context = null
let source = null
let gainNode = null

export const ambientSupported = () =>
    typeof window !== 'undefined' && Boolean(window.AudioContext ?? window.webkitAudioContext)

export const isAmbientPlaying = () => Boolean(source && context && context.state === 'running')

// Brown noise: a random walk, gentler than white noise and close enough to distant rain
// that the label on the selector is not a lie about a musical track.
const buildNoiseBuffer = (audioContext) => {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0

    for (let i = 0; i < data.length; i += 1) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
    }

    return buffer
}

export const stopAmbient = () => {
    try {
        source?.stop()
        source?.disconnect()
        gainNode?.disconnect()
        context?.close()
    } catch {
        // Already stopped or closed — nothing to salvage.
    }

    source = null
    gainNode = null
    context = null
}

/*
 * Start (or restart) the ambience at `level` 0–1. Resolves true only when a context is
 * actually running — the honest signal the toggle uses to decide its own state.
 */
export const startAmbient = async (level = 0.45) => {
    if (!ambientSupported()) return false

    stopAmbient()

    try {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
        const audioContext = new AudioContextClass()

        if (audioContext.state === 'suspended') await audioContext.resume()

        const sourceNode = audioContext.createBufferSource()
        sourceNode.buffer = buildNoiseBuffer(audioContext)
        sourceNode.loop = true

        const filter = audioContext.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 900

        const gain = audioContext.createGain()
        gain.gain.value = Math.max(0, Math.min(1, level)) * 0.5

        sourceNode.connect(filter)
        filter.connect(gain)
        gain.connect(audioContext.destination)
        sourceNode.start()

        context = audioContext
        source = sourceNode
        gainNode = gain

        return audioContext.state === 'running'
    } catch {
        stopAmbient()
        return false
    }
}

// Live volume change without restarting the buffer (avoids an audible seam).
export const setAmbientLevel = (level) => {
    if (!gainNode || !context) return

    gainNode.gain.value = Math.max(0, Math.min(1, level)) * 0.5
}
