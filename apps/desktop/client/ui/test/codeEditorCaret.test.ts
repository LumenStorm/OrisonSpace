import { describe, it, expect } from 'vitest';
import { caretAfterSwap } from '../src/features/editor/file-editor/CodeEditor';

// Undo/redo caret placement: after restoring `to` from `from`, the caret must
// land at the end of the region that changed, so editing continues right after
// the restored text (the "延续在原来的字符之后" behavior).
describe('caretAfterSwap', () => {
  it('places caret after an undone insertion (text removed)', () => {
    // User typed "X" at index 5; undo removes it. from has the X, to does not.
    const from = 'hello Xworld';
    const to = 'hello world';
    // Changed span ends right where "X" was removed → index 6 ("hello ").
    expect(caretAfterSwap(from, to)).toBe(6);
  });

  it('places caret after a redone insertion (text added back)', () => {
    const from = 'hello world';
    const to = 'hello Xworld';
    // "X" is the changed span; caret sits just after it.
    expect(caretAfterSwap(from, to)).toBe(7);
  });

  it('handles appended text at the end', () => {
    expect(caretAfterSwap('abc', 'abcdef')).toBe(6);
  });

  it('handles deletion at the end', () => {
    expect(caretAfterSwap('abcdef', 'abc')).toBe(3);
  });

  it('handles a replacement in the middle', () => {
    // "cat" -> "dog" inside the same surroundings.
    expect(caretAfterSwap('a cat z', 'a dog z')).toBe(5);
  });

  it('handles prepended text', () => {
    expect(caretAfterSwap('world', 'hello world')).toBe(6);
  });

  it('returns end when contents are identical', () => {
    expect(caretAfterSwap('same', 'same')).toBe(4);
  });

  it('handles empty target (everything deleted)', () => {
    expect(caretAfterSwap('abc', '')).toBe(0);
  });

  it('handles repeated characters without overshooting', () => {
    // from "aaa" to "aa": one 'a' removed; common prefix "aa", no shared suffix
    // beyond it → caret at end (2).
    expect(caretAfterSwap('aaa', 'aa')).toBe(2);
  });
});
