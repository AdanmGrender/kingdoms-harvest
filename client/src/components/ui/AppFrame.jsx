// Marco de la app: ancho del viewport, alto visible (--kh-app-h) con tope de aspecto.
// Ver styles/index.css (.kh-shell / .kh-frame) y utils/viewport.js.
export default function AppFrame({ children }) {
  return (
    <div className="kh-shell">
      <div className="kh-frame">{children}</div>
    </div>
  );
}
