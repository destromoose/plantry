'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { joinHousehold, peekHousehold } from '@/lib/sync'
import { formatCode } from '@/lib/syncCode'
import { useStore } from '@/lib/store'
import { pluralize } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'

type Peek = Awaited<ReturnType<typeof peekHousehold>>

/** Join a household someone already shared, from a code or an invite link. */
export function JoinHousehold() {
  const router = useRouter()
  const params = useSearchParams()
  const onboarded = useStore((s) => s.settings.onboarded)
  const hasData = useStore(
    (s) => s.plan.length + s.pantry.length + s.shop.length + s.cooked.length > 0
  )
  const [code, setCode] = useState(params.get('code') ?? '')
  const [peek, setPeek] = useState<Peek | null>(null)
  const [me, setMe] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)

  async function find(input = code) {
    setBusy(true)
    setError(null)
    try {
      setPeek(await peekHousehold(input))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // An invite link fills the code in; look it up straight away.
  useEffect(() => {
    const c = params.get('code')
    if (c && !tried.current) {
      tried.current = true
      void find(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function join() {
    if (!peek) return
    joinHousehold(peek, me)
    toast('Joined. This phone now shares with your household.')
    router.replace('/')
  }

  const d = peek?.doc
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-8 pt-10">
      <div className="mb-8">
        <Logo className="text-ink" />
      </div>
      <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
        Join your household
      </h1>
      {!peek ? (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void find()
          }}
        >
          <p className="text-[0.9375rem] text-ink-2">
            Type the 12-letter code from the phone that shared. It&apos;s in Settings on that phone,
            under Share with your household.
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKMN"
            aria-label="Household code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            className="text-center font-display text-2xl tracking-[0.08em]"
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !code.trim()}>
            {busy ? 'Looking…' : 'Find household'}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="card p-4 text-[0.9375rem] text-ink-2">
            <p className="font-medium text-ink">Household {formatCode(peek.code)}</p>
            <p className="mt-1">
              {d!.members.length ? d!.members.map((m) => m.name).join(', ') : 'No names yet'}.{' '}
              {pluralize(d!.recipes.filter((r) => r.custom).length, 'own recipe')},{' '}
              {pluralize(d!.plan.length, 'planned meal')}, {pluralize(d!.shop.length, 'thing')} on
              the list.
            </p>
          </div>
          {d!.members.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Which one is you?</p>
              <div
                role="radiogroup"
                aria-label="Which one is you?"
                className="flex flex-wrap gap-2"
              >
                {d!.members.map((m) => (
                  <Chip
                    key={m.id}
                    role="radio"
                    aria-checked={me === m.id}
                    aria-pressed={undefined}
                    selected={me === m.id}
                    onClick={() => setMe(me === m.id ? undefined : m.id)}
                  >
                    {m.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {onboarded && hasData && (
            <p className="text-sm text-ink-3">
              This phone&apos;s plan, pantry, list and history are replaced by the household&apos;s.
              Recipes you added here are kept and shared. Export first in Settings if you want a
              copy.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={join}>
              Join
            </Button>
            <Button variant="ghost" onClick={() => setPeek(null)}>
              Use a different code
            </Button>
          </div>
        </div>
      )}
      <div className="mt-auto pt-10 text-center">
        <Link
          href={onboarded ? '/settings' : '/onboarding'}
          className="text-sm text-ink-2 underline"
        >
          {onboarded ? 'Back to Settings' : 'Set up a new household instead'}
        </Link>
      </div>
    </div>
  )
}
