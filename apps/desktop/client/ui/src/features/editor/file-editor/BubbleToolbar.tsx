import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';

const items = [
  { command: 'toggleBold', icon: 'format_bold', active: 'bold' },
  { command: 'toggleItalic', icon: 'format_italic', active: 'italic' },
  { command: 'toggleStrike', icon: 'strikethrough_s', active: 'strike' },
  { command: 'toggleCode', icon: 'code', active: 'code' },
] as const;

export function BubbleToolbar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor}>
      <div className="bubble-toolbar">
        {items.map((item) => (
          <button
            key={item.command}
            type="button"
            className={`bubble-toolbar-btn${editor.isActive(item.active) ? ' is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              (editor.chain().focus() as any)[item.command]().run();
            }}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}
