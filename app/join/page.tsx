import { Suspense } from 'react'
import { JoinHousehold } from '@/components/features/sync/JoinHousehold'

export const metadata = { title: 'Join a household' }

export default function Page() {
  return (
    <Suspense>
      <JoinHousehold />
    </Suspense>
  )
}
