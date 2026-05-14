// Renders nothing when no modal route is active. Required by Next.js
// parallel routing: every slot needs a default unless a matching route
// is present, otherwise the slot 404s and the page can't render.
export default function ModalDefault() {
  return null;
}
