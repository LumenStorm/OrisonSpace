import type { CreativeFieldKey } from '@orison/shared-contracts';
import { creativeFieldKeys } from '@orison/shared-contracts';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { FieldHeader } from './FieldHeader';
import { WorldSettingView } from './WorldSettingView';
import { AssetCardsList } from './AssetCardsList';
import { RelationshipGraphEditor } from './RelationshipGraphEditor';
import { OutlineV2View } from './OutlineV2View';
import { EpisodeOutlinesList } from './EpisodeOutlinesList';
import { CurvesView } from './CurvesView';
import { CreativeBriefView } from './CreativeBriefView';

const TAB_ORDER: CreativeFieldKey[] = [
  'world_setting', 'asset_cards', 'relationship_graph',
  'outline', 'episode_outlines',
  'growth_curve', 'pacing_curve', 'emotion_curve',
  'creative_brief'
];

const fieldViews: Record<CreativeFieldKey, React.FC> = {
  creative_brief: CreativeBriefView,
  world_setting: WorldSettingView,
  asset_cards: AssetCardsList,
  relationship_graph: RelationshipGraphEditor,
  outline: OutlineV2View,
  episode_outlines: EpisodeOutlinesList,
  growth_curve: () => <CurvesView curveType="growth_curve" />,
  pacing_curve: () => <CurvesView curveType="pacing_curve" />,
  emotion_curve: () => <CurvesView curveType="emotion_curve" />,
};

export function CreativeFieldsEditor() {
  const { activeCreativeTab, setActiveCreativeTab, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      activeCreativeTab: s.activeCreativeTab,
      setActiveCreativeTab: s.setActiveCreativeTab,
      resolvedLocale: s.resolvedLocale,
    }))
  );

  const { t } = useI18n(resolvedLocale);
  const FieldView = fieldViews[activeCreativeTab];

  return (
    <div className="creative-editor">
      <nav className="creative-tabs" aria-label="Creative Field Tabs">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`creative-tab${key === activeCreativeTab ? ' creative-tabActive' : ''}`}
            onClick={() => setActiveCreativeTab(key)}
            aria-current={key === activeCreativeTab ? 'page' : undefined}
          >
            {t(`creative.tabs.${key}`)}
          </button>
        ))}
      </nav>
      <div className="creative-field-content">
        <FieldHeader field={activeCreativeTab} />
        <FieldView />
      </div>
    </div>
  );
}
