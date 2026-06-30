import { Skeleton } from './Skeleton';

type Variant = 'sidebar' | 'page' | 'panel';

export function PageSkeleton({ variant = 'page' }: { variant?: Variant }) {
  if (variant === 'sidebar') {
    return (
      <div role="status" aria-busy="true" aria-label="Loading" style={{ padding: '0.6rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton width="70%" height="0.75rem" />
        <Skeleton width="85%" height="0.75rem" />
        <Skeleton width="60%" height="0.75rem" />
        <Skeleton width="90%" height="0.75rem" />
        <Skeleton width="50%" height="0.75rem" />
        <Skeleton width="75%" height="0.75rem" />
      </div>
    );
  }

  if (variant === 'panel') {
    return (
      <div role="status" aria-busy="true" aria-label="Loading" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Skeleton width="40%" height="1rem" />
        <Skeleton width="100%" height="0.75rem" />
        <Skeleton width="80%" height="0.75rem" />
        <Skeleton width="60%" height="0.75rem" />
      </div>
    );
  }

  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Skeleton width="30%" height="1.2rem" />
      <Skeleton width="100%" height="0.8rem" />
      <Skeleton width="90%" height="0.8rem" />
      <Skeleton width="95%" height="0.8rem" />
      <Skeleton width="100%" height="8rem" borderRadius="0.5rem" />
    </div>
  );
}
