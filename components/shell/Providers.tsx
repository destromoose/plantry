'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useStore } from '@/lib/store'
import { buildContext, fetchWeather, msUntilNextChange } from '@/lib/context'
import { toDateKey } from '@/lib/utils'
import type { Context } from '@/lib/types'

const ContextCtx = createContext<Context | null>(null)
const StayCtx = createContext<(on: boolean) => void>(() => {})

/** Keep the Tonight screen on today after the late-evening cutoff. */
export const useStayTonight = () => useContext(StayCtx)

/** The current adaptive context. Rebuilt at launch, on the hour band change, and on tab return. */
export function useAppContext(): Context {
  const ctx = useContext(ContextCtx)
  if (!ctx) throw new Error('useAppContext must be used inside Providers')
  return ctx
}

export function Providers({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings)
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const weather = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)
  const [tick, setTick] = useState(0)
  // "Still tonight" is remembered for the day it was asked on.
  const [stayDate, setStayDate] = useState<string | null>(null)

  // Re-run the engine on a clear change only: exactly when the next mood band, the
  // late-evening cutoff or midnight arrives, and when the tab becomes visible again.
  useEffect(() => {
    const id = setTimeout(() => setTick((t) => t + 1), msUntilNextChange(new Date()))
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [tick])

  // Weather, only when the user opted in on the Tonight screen.
  useEffect(() => {
    if (!settings.weatherEnabled || typeof navigator === 'undefined' || !navigator.geolocation)
      return
    const stale = !weather || Date.now() - new Date(weather.fetchedAt).getTime() > 60 * 60 * 1000
    if (!stale) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => setWeather(await fetchWeather(pos.coords.latitude, pos.coords.longitude)),
      () => setWeather(undefined),
      { maximumAge: 30 * 60 * 1000, timeout: 8000 }
    )
  }, [settings.weatherEnabled, weather, setWeather])

  const context = useMemo(
    () => {
      const now = new Date()
      return buildContext({
        now,
        settings,
        weather,
        plan,
        recipes,
        stillTonight: stayDate === toDateKey(now),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.mood, settings.weatherEnabled, weather, plan, recipes, tick, stayDate]
  )

  // Apply the mood to <html> so CSS tokens switch, with a soft crossfade.
  useEffect(() => {
    document.documentElement.dataset.mood = context.mood
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', context.mood === 'night' ? '#1E1620' : '#FAF4EA')
  }, [context.mood])

  const reduced =
    settings.reducedMotion === 'on' ? 'always' : settings.reducedMotion === 'off' ? 'never' : 'user'

  return (
    <ContextCtx.Provider value={context}>
      <StayCtx.Provider value={(on) => setStayDate(on ? toDateKey(new Date()) : null)}>
        <MotionConfig reducedMotion={reduced}>{children}</MotionConfig>
      </StayCtx.Provider>
    </ContextCtx.Provider>
  )
}
