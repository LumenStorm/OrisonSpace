# Design System Specification: The Literary Sanctuary

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Literary Sanctuary."** 

In an era of chaotic, high-stimulus AI tools, this system moves in the opposite direction. It is a premium, editorial-first environment designed for deep work. We are moving away from the "SaaS Dashboard" look—characterized by heavy borders and rigid grids—and toward a high-end digital atelier. 

The aesthetic is driven by **Tonal Layering** and **Intentional Asymmetry**. Instead of boxing content into containers, we allow the content to define the space. We prioritize a "Paper on Desk" metaphor: the writing surface feels like a tactile object resting on a soft, ambient background. This is not a utility; it is an instrument of precision.

---

## 2. Color & Chromatic Harmony
The palette is rooted in a sophisticated range of "warm neutrals" and "cool charcoals." We avoid pure black and pure white to reduce eye strain and increase the perceived premium quality of the interface.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define primary layout sections. Structure must be achieved through:
- **Tonal Shifts:** Placing a `surface_container_low` (#f2f4f3) side panel against a `surface` (#f9f9f8) main workspace.
- **Generous Negative Space:** Using the Spacing Scale to create "gutters" that act as invisible boundaries.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials.
1. **The Base (Surface):** The desk. Use `surface` (#f9f9f8) for the overall background.
2. **The Workspace (Surface-Container-Lowest):** The paper. Use `surface_container_lowest` (#ffffff) for the primary writing area to provide maximum contrast for text.
3. **The Utility (Surface-Container-High):** The tools. Use `surface_container_high` (#e4e9e8) for floating panels or navigation.

### The "Glass & Gradient" Rule
To prevent the UI from feeling "flat" or "template-like," apply these signature treatments:
- **Floating Elements:** Use `surface_container_lowest` with a 20% opacity and a 16px backdrop-blur for menus or tooltips.
- **Signature Textures:** Primary actions should use a subtle linear gradient from `primary` (#4552c3) to `primary_dim` (#3845b6) at 135 degrees. This provides a "weighted" feel that a flat color lacks.

---

## 3. Typography: The Editorial Voice
Typography is the core of this system. We use two distinct families to balance utility with high-end editorial soul.

### UI Typeface: Manrope (Sans-Serif)
Manrope is used for the "machinery" of the app—labels, buttons, navigation, and settings. It is geometric, modern, and highly legible at small sizes.
- **Label-MD:** 0.75rem. Used for metadata and micro-copy.
- **Title-SM:** 1rem. Used for side-bar navigation and section headers.

### Content Typeface: Newsreader (Serif)
Newsreader is the "soul" of the system. It is used for the user's actual writing and major headlines. It evokes the feeling of a prestige publication (The New Yorker or Kinfolk).
- **Display-LG:** 3.5rem. Used for document titles.
- **Body-LG:** 1rem. Used for the primary writing experience with a generous 1.6x line height.

---

## 4. Elevation & Depth
In this system, depth is a function of light and shadow, not lines.

- **The Layering Principle:** Rather than using a border to separate a sidebar, use a `surface_container_low` background. When a card is placed on that sidebar, use `surface_container_lowest` to create a natural, "raised" effect.
- **Ambient Shadows:** When a floating element (like a modal) is required, use an extra-diffused shadow:
  - `box-shadow: 0 12px 40px rgba(45, 52, 51, 0.06);`
  - The shadow color is a tinted version of `on_surface` to maintain chromatic harmony.
- **The "Ghost Border":** If a boundary is strictly required for accessibility, use the `outline_variant` (#adb3b2) at 15% opacity. Never use 100% opaque borders.
- **Glassmorphism:** Navigation bars should always use a backdrop-blur (12px) with a semi-transparent `surface` color to allow the "content" to bleed through as the user scrolls, creating an integrated, fluid feel.

---

## 5. Signature Components

### Buttons
- **Primary:** Gradient (`primary` to `primary_dim`), `xl` (0.75rem) rounded corners, white text. Subtle inner-glow (1px, white, 10% opacity) on the top edge for a tactile feel.
- **Secondary:** Transparent background with a `Ghost Border` and `primary` colored text.
- **Tertiary:** No background or border. Uses `on_surface_variant` text that shifts to `primary` on hover.

### The Writing Canvas (Custom Component)
The central writing area should not have a visible "box." It is a wide column of `surface_container_lowest` (#ffffff) centered within the `surface` (#f9f9f8). 
- **Padding:** 80px top/bottom, adaptive side margins (max-width 720px).
- **Caret:** Use the `primary` color (#4552c3) for the blinking cursor to provide a singular point of focus.

### Input Fields
- **Style:** No bottom line or full border. Use a subtle background fill of `surface_container` (#ebeeed) with `md` (0.375rem) rounded corners.
- **Focus State:** Transition the background to `surface_container_lowest` (#ffffff) and apply a 1px `Ghost Border` of the `primary` color.

### Chips & Tags
- Used for AI-suggested keywords or document tags.
- **Style:** `surface_container_highest` background, `on_surface` text, `full` rounded corners. No borders.

---

## 6. Do’s and Don'ts

### Do:
- **Do** use whitespace as a functional tool to group related items.
- **Do** use `Newsreader` for any text that is meant to be "read" (articles, notes, AI responses).
- **Do** use `Manrope` for any text that is meant to be "acted upon" (menus, buttons, counts).
- **Do** lean into asymmetry. A sidebar on the left and a floating utility panel on the right creates a sophisticated, non-standard rhythm.

### Don't:
- **Don't** use 1px solid borders for layout containers.
- **Don't** use pure black (#000000) for text. Use `on_surface` (#2d3433) for a softer, more premium look.
- **Don't** use standard "drop shadows." Use the ambient, low-opacity tinted shadows specified in Section 4.
- **Don't** use more than one `primary` color action per view. The indigo accent is a "high-value" signal; overusing it dilutes the calm.