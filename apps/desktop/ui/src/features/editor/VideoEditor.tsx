export function VideoEditor() {
  return (
    <div className="video-editor">
      <div className="video-preview">
        <div className="video-preview-placeholder">
          <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
          <p>Video preview will appear here</p>
        </div>
      </div>
      <div className="video-timeline">
        <p className="video-timeline-empty">
          No clips yet. Generate video from storyboard shots to populate the timeline.
        </p>
      </div>
    </div>
  );
}
