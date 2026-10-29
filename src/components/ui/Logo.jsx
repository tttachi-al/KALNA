/**
 * Marca KALLPA ("fuerza" en quechua): tres peldaños que suben,
 * inspirados en los escalonados de los tejidos andinos.
 */
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="var(--logo-bg, var(--peru))" />
      <path d="M9 30h7v-6h7v-6h8" fill="none" stroke="var(--logo-fg, #fff)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="12" r="3.2" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({ onNight = false }) {
  return (
    <span className={`logo ${onNight ? 'logo-night' : ''}`}>
      <LogoMark />
      <span className="logo-text">
        <span className="logo-word">KALNA</span>
      </span>
    </span>
  );
}
