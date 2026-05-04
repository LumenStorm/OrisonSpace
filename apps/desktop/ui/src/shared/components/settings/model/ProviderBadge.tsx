import type { GenerationProvider } from '@orison/shared-contracts';
import { getProviderDescriptor } from './utils';

type Props = {
  provider: GenerationProvider;
  t: (key: string) => string;
  /** When true, render only the dot (no label). Useful in compact rows. */
  compact?: boolean;
};

export function ProviderBadge({ provider, t, compact = false }: Props) {
  const descriptor = getProviderDescriptor(provider);
  const dotStyle = { background: `var(--${descriptor.tokenName})` };

  return (
    <span className={`provider-badge${compact ? ' provider-badge-compact' : ''}`}>
      <span className="provider-badge-dot" style={dotStyle} aria-hidden="true" />
      {!compact && <span className="provider-badge-label">{t(descriptor.labelKey)}</span>}
    </span>
  );
}
