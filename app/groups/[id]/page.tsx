// app/groups/[id]/page.tsx
import GroupDetailClient from './GroupDetailClient';

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export const dynamicParams = true;

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  return <GroupDetailClient groupId={params.id} />;
}

// Updated: 2026-10-23T06:25:00Z
