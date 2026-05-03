import { useAppStore } from '../../shared/store/appStore';

export function AcceptedPatchesView() {
  const patches = useAppStore((state) => state.acceptedPatches);
  if (patches.length === 0) return null;

  return (
    <div className="accepted-patches">
      {patches.map((operation, index) => (
        <div key={index}>
          <label>{operation.path}</label>
          <input readOnly value={String(operation.value)} />
        </div>
      ))}
    </div>
  );
}
