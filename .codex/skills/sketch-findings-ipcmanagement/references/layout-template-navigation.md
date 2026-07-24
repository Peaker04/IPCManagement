# Layout & Template Navigation

## Design Decisions

- Use Sketch 001 Variant C, **Template Studio**, as the page shell.
- Keep customer and template navigation in a fixed left rail. Show inheritance state, such as `Kế thừa mẫu ANV`, and version/draft state without opening another screen.
- Make the workbook grid the largest region. The primary editing task is spatial, so source cell relationships must dominate the layout.
- Keep mapping properties, validation metrics, preview status, source/inheritance metadata, actor, and version in a persistent right inspector.
- Keep system actions in a dark Fiori shell bar: `Kiểm tra` secondary and `Lưu phiên bản` primary.
- Treat ANV as an immutable system fallback. Customer overrides must visibly identify their source and never appear to mutate the default.
- Desktop/tablet landscape is the full editing surface. Below approximately 950px, replace the three-column editor with a summary and read-only preview; do not squeeze the spreadsheet into a phone viewport.

## CSS Patterns

```css
.studio {
  display: grid;
  grid-template-columns: 250px minmax(620px, 1fr) 330px;
  min-height: calc(100vh - 169px);
}

.studio-nav { border-right: 1px solid var(--color-border); }
.studio-inspector { border-left: 1px solid var(--color-border); }
.studio-center { min-width: 0; padding: 12px; }

.nav-item.active {
  border-left: 3px solid var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

@media (max-width: 950px) {
  .desktop-editor { display: none; }
  .mobile-summary { display: block; }
}
```

Use the shared Fiori theme tokens instead of raw colors inside React components. Important values from the winning theme include:

- Shell: `#354a5f`
- Primary: `#0a6ed1`
- Canvas: `#f7f7f7`
- Text: `#223548`
- Border: `#d9d9d9`
- Compact control height: `32px`
- Border radii: `2px` to `4px`

## HTML Structures

```html
<header class="template-shellbar">…global/template actions…</header>
<div class="template-context">…search, customer, draft status…</div>
<main class="studio">
  <aside class="studio-nav">…customers and templates…</aside>
  <section class="studio-center">…workbook grid…</section>
  <aside class="studio-inspector">…mapping, preview, version…</aside>
</main>
```

The left rail should use real buttons or links with an explicit active state. The center must use an independently scrollable table viewport. The right inspector should remain in the same reading order as the workflow: selection properties, immediate validation, then version/source metadata.

## What to Avoid

- Do not use the selected Split Workbench alternative as the overall navigation model; it lacks persistent multi-customer/template context.
- Do not make the full workflow a modal wizard. The wizard reduced visual complexity but hid source context and made repeated template administration slower.
- Do not use cards or large rounded surfaces that conflict with the compact enterprise/Fiori direction.
- Do not make mobile users manipulate a scaled-down spreadsheet grid.

## Origin

Synthesized from sketch: 001-fiori-mapping-layout, winner C.
Source file: `sources/001-fiori-mapping-layout/index.html`.
