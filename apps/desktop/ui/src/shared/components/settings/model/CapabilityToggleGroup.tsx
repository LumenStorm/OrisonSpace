import type { ModelCapability } from '@orison/shared-contracts';
import { CAPABILITY_OPTIONS, toggleCapability } from './utils';

type Props = {
  value: ModelCapability[];
  onChange: (next: ModelCapability[]) => void;
  t: (key: string) => string;
};

const CAPABILITY_LABEL_KEY: Record<ModelCapability, string> = {
  text: 'settings.capabilityText',
  image: 'settings.capabilityImage',
  video: 'settings.capabilityVideo',
};

export function CapabilityToggleGroup({ value, onChange, t }: Props) {
  return (
    <div className="capability-toggle-group" role="group" aria-label={t('settings.capabilities')}>
      {CAPABILITY_OPTIONS.map((capability) => {
        const enabled = value.includes(capability);
        return (
          <button
            key={capability}
            type="button"
            className={`sidebar-settings-option${enabled ? ' is-active' : ''}`}
            aria-pressed={enabled}
            onClick={() => onChange(toggleCapability(value, capability, !enabled))}
          >
            {t(CAPABILITY_LABEL_KEY[capability])}
          </button>
        );
      })}
    </div>
  );
}
