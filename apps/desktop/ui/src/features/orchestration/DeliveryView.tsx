import type { RunSnapshot } from './types';

export function DeliveryView({ run }: { run: RunSnapshot }) {
  return (
    <div className="orchestration-delivery" aria-label="Delivery Output">
      <p>宸蹭氦浠?鈥?{run.delivery?.summary}</p>
      {run.archive ? <p>褰掓。鐗堟湰: {run.archive.versionId}</p> : null}
      {run.feedback?.memo ? <p>鍥炴祦澶囨敞: {run.feedback.memo}</p> : null}
    </div>
  );
}
