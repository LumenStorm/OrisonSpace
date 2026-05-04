import type { FileTab } from '../../../shared/store/fileTabsSlice';

export function ImagePreview({ file }: { file: FileTab }) {
  if (!file.dataUrl) {
    return (
      <div className="file-editor-readonly">
        <span className="material-symbols-outlined" aria-hidden="true">broken_image</span>
        <p>{file.name}</p>
      </div>
    );
  }

  return (
    <div className="file-editor-image">
      <img className="file-editor-image-content" src={file.dataUrl} alt={file.name} />
    </div>
  );
}
