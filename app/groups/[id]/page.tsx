// app/groups/[id]/page.tsx
// Server component wrapper for static export
export async function generateStaticParams() {
  // For static export with dynamic routes, return empty array
  // The page will handle client-side rendering
  return [];
}

export const dynamicParams = false;

// Import and render the client component
import GroupDetailClient from './GroupDetailClient';

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  return <GroupDetailClient groupId={params.id} />;
}
