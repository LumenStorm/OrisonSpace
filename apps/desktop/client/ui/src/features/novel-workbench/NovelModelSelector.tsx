import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { listNovelTextModelRefs } from '../../shared/model/novelModel';

export function NovelModelSelector() {
  const { modelConfig, selectedNovelRef, setSelectedNovelRef, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      modelConfig: s.modelConfig,
      selectedNovelRef: s.selectedNovelRef,
      setSelectedNovelRef: s.setSelectedNovelRef,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);
  const options = listNovelTextModelRefs(modelConfig.keys);
  const selected = selectedNovelRef ? `${selectedNovelRef.keyId}:${selectedNovelRef.modelId}` : '';

  return (
    <label className="novel-model-selector">
      <span>{t('novelChapter.model')}</span>
      <select
        value={selected}
        onChange={(event) => {
          const next = options.find((option) => `${option.ref.keyId}:${option.ref.modelId}` === event.target.value);
          setSelectedNovelRef(next?.ref ?? null);
        }}
      >
        <option value="">{options.length > 0 ? t('novelChapter.modelAuto') : t('novelChapter.noTextModel')}</option>
        {options.map((option) => (
          <option key={`${option.ref.keyId}:${option.ref.modelId}`} value={`${option.ref.keyId}:${option.ref.modelId}`}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
