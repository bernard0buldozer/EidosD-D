export function MushroomMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="mushroom-mark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3 15C5 7 10 3 16 3s11 4 13 12c-7 3-19 3-26 0Z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path d="M13 17c0 5-1 9-3 12h12c-2-3-3-7-3-12M7 14l3-5m4 6 1-7m6 7-2-7m6 6-3-5" />
      <circle cx="10" cy="6" r="1" />
      <circle cx="20" cy="6" r="1" />
    </svg>
  );
}
