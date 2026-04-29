/**
 * Mock file contents for the project file tree.
 * Will be replaced by real IPC file reads later.
 */
export const mockFileContents: Record<string, string> = {
  '/project.yaml': `name: "My Story Project"
type: novel
version: 1
created: 2025-01-15
author: ""
description: "A story about..."
settings:
  visual_style: cinematic
  narrative_style: linear
  pacing: rhythmic
`,

  '/chapters/ch-001.md': `# Chapter 1: The Beginning

The morning light filtered through the curtains, casting long shadows across the wooden floor. She stood by the window, watching the city slowly wake up below.

"It's time," she whispered to no one in particular.

The letter on the desk had changed everything. Three words, written in a hand she hadn't seen in years, had pulled her back to a place she thought she'd left behind forever.

## The Letter

> *Come home now.*

She folded it carefully and slipped it into her coat pocket. There was no return address, but she didn't need one. She knew exactly where it came from.
`,

  '/chapters/ch-002.md': `# Chapter 2: The Journey

The train rattled through the countryside, fields of gold stretching to the horizon. She pressed her forehead against the cool glass and watched the world blur past.

Memories surfaced unbidden — the old house on the hill, the garden where they used to play, the sound of laughter echoing through empty rooms.

## On the Train

The conductor passed through, punching tickets with mechanical precision. She handed hers over without looking up.

"Long way to go," he remarked.

"Yes," she said. "A very long way."
`,

  '/scenes/sc-001.md': `# Scene 1: The Apartment — Morning

**INT. APARTMENT — MORNING**

*A small, cluttered apartment. Morning light streams through half-open blinds. ELENA (30s) stands at the window in a wrinkled shirt, coffee in hand.*

ELENA
*(reading the letter)*
This can't be real.

*She sets down the coffee. Her hands are trembling.*

ELENA
*(to herself)*
After all this time...

*She crosses to the desk, picks up her phone, dials. It rings. No answer.*
`,

  '/scenes/sc-002.md': `# Scene 2: The Train Station — Afternoon

**EXT. TRAIN STATION — AFTERNOON**

*A provincial train station, nearly empty. Wind blows leaves across the platform. ELENA steps off the train carrying a single bag.*

*She looks around. The station hasn't changed. The same faded bench, the same clock tower in the distance.*

ELENA
*(quietly)*
Nothing's changed.

*She walks toward the exit, her footsteps echoing on the concrete.*
`,
};
