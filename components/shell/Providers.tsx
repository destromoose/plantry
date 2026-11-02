'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useStore } from '@/lib/store'
import { buildContext, fetchWeather } from '@/lib/context'
import type { Context } from '@/lib/types'

const ContextCtx = createContext<Context | null>(null)

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

  // Re-run the engine on a clear change only: when the hour band might have moved
  // (every 15 minutes) or when the tab becomes visible again after 20 minutes away.
  useEffect(() => {
    let hidden = 0
    const id = setInterval(() => setTick((t) => t + 1), 15 * 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'hidden') hidden = Date.now()
      else if (hidden && Date.now() - hidden > 20 * 60 * 1000) setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

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
    () => buildContext({ now: new Date(), settings, weather, plan, recipes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.mood, settings.weatherEnabled, weather, plan, recipes, tick]
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
      <MotionConfig reducedMotion={reduced}>{children}</MotionConfig>
    </ContextCtx.Provider>
  )
}
