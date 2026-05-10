import { useAppStore } from '../../shared/store/appStore';

export function NovelHome() {
  const openGuidedNovelWorkspace = useAppStore((s) => s.openGuidedNovelWorkspace);
  const selectNovelObjectCategory = useAppStore((s) => s.selectNovelObjectCategory);

  return (
    <section className="novel-home" aria-label="Novel Home">
      <header className="novel-home-hero">
        <p className="novel-home-kicker">小说工作台</p>
        <h1>今天从哪里继续这部小说？</h1>
        <p>从引导创作进入整体驾驶舱，或直接回到章节与对象继续手动写作。</p>
      </header>

      <div className="novel-home-actions">
        <button type="button" className="novel-home-primary" onClick={openGuidedNovelWorkspace}>
          开始引导创作
        </button>
        <button
          type="button"
          className="novel-home-secondary"
          onClick={() => selectNovelObjectCategory('chapters')}
        >
          继续手动写作
        </button>
      </div>

      <div className="novel-home-grid">
        <article className="novel-home-card">
          <h2>最近章节</h2>
          <p>从章节列表回到最近写作位置，继续正文推进与修改。</p>
        </article>
        <article className="novel-home-card">
          <h2>最近角色</h2>
          <p>查看最近活跃角色、关系变更和角色档案更新。</p>
        </article>
        <article className="novel-home-card">
          <h2>运行记录</h2>
          <p>查看最近一次自动生成、审阅和补丁写入结果。</p>
        </article>
        <article className="novel-home-card">
          <h2>最近图像资产</h2>
          <p>继续补充角色参考图、场景图和道具视觉档案。</p>
        </article>
      </div>
    </section>
  );
}
