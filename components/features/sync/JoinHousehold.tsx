'use client'

import { t } from '@/lib/i18n'

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
import { MAX_PEOPLE } from '@/components/features/onboarding/Onboarding'
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
  /** Set when the person isn't on the list yet. */
  const [newName, setNewName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)

  async function find(input = code) {
    setBusy(true)
    setError(null)
    try {
      const found = await peekHousehold(input)
      setPeek(found)
      // A household with nobody named yet: this phone's person is the first.
      setNewName(found.doc.members.length ? null : '')
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
    joinHousehold(peek, newName === null ? me : undefined, newName ?? undefined)
    toast(t('Joined. This phone now shares with your household.'))
    router.replace('/')
  }

  const d = peek?.doc
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-8 pt-10">
      <div className="mb-8">
        <Logo className="text-ink" />
      </div>
      <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
        {t('Join your household')}
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
            {t(
              "Type the 12-letter code from the phone that shared. It's in Settings on that phone, under Share with your household."
            )}
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKMN"
            aria-label={t('Household code')}
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
            {busy ? t('Looking…') : t('Find household')}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="card p-4 text-[0.9375rem] text-ink-2">
            <p className="font-medium text-ink">
              {t('Household {v0}', { v0: formatCode(peek.code) })}
            </p>
            <p className="mt-1">
              {d!.members.length ? d!.members.map((m) => m.name).join(', ') : t('No names yet')}.{' '}
              {pluralize(d!.recipes.filter((r) => r.custom).length, 'own recipe')}
              {t(', {v0}, {v1} on the list.', {
                v0: pluralize(d!.plan.length, 'planned meal'),
                v1: pluralize(d!.shop.length, 'thing'),
              })}
            </p>
          </div>
          {d!.members.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">{t('Which one is you?')}</p>
              <div
                role="radiogroup"
                aria-label={t('Which one is you?')}
                className="flex flex-wrap gap-2"
              >
                {d!.members.map((m) => (
                  <Chip
                    key={m.id}
                    role="radio"
                    aria-checked={me === m.id}
                    aria-pressed={undefined}
                    selected={newName === null && me === m.id}
                    onClick={() => {
                      setNewName(null)
                      setMe(me === m.id ? undefined : m.id)
                    }}
                  >
                    {m.name}
                  </Chip>
                ))}
                {d!.members.length < MAX_PEOPLE && (
                  <Chip
                    role="radio"
                    aria-checked={newName !== null}
                    aria-pressed={undefined}
                    selected={newName !== null}
                    onClick={() => setNewName(newName === null ? '' : null)}
                  >
                    {t('Someone new')}
                  </Chip>
                )}
              </div>
            </div>
          )}
          {(newName !== null || d!.members.length === 0) && (
            <div>
              <label htmlFor="new-name" className="mb-2 block text-sm font-medium text-ink-2">
                {t('Your name')}
              </label>
              <Input
                id="new-name"
                value={newName ?? ''}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                autoFocus={d!.members.length > 0}
              />
            </div>
          )}
          {onboarded && hasData && (
            <p className="text-sm text-ink-3">
              {t(
                "This phone's plan, pantry, list and history are replaced by the household's. Recipes you added here are kept and shared. Export first in Settings if you want a copy."
              )}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={join} disabled={newName !== null && !newName.trim()}>
              {t('Join')}
            </Button>
            <Button variant="ghost" onClick={() => setPeek(null)}>
              {t('Use a different code')}
            </Button>
          </div>
        </div>
      )}
      <div className="mt-auto pt-10 text-center">
        <Link
          href={onboarded ? '/settings' : '/onboarding'}
          className="text-sm text-ink-2 underline"
        >
          {onboarded ? t('Back to Settings') : t('Set up a new household instead')}
        </Link>
      </div>
    </div>
  )
}
