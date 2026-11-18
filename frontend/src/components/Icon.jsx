const paths = {
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m3 3 18 18M9 5.5A12 12 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 4M6 7C3.5 9 2 12 2 12s3.5 7 10 7a12 12 0 0 0 5-1M10 10a3 3 0 0 0 4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  filter: (
    <>
      <path d="M3 6h18M6 12h12M9 18h6" />
      <circle cx="8" cy="6" r="2" fill="var(--paper)" />
      <circle cx="16" cy="12" r="2" fill="var(--paper)" />
    </>
  ),
  grid2: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </>
  ),
  grid3: (
    <>
      <rect x="2" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <rect x="17" y="4" width="5" height="16" rx="1" />
    </>
  ),
  grid4: (
    <>
      {[2, 7.5, 13, 18.5].map((x) => (
        <rect key={x} x={x} y="4" width="3.5" height="16" rx="0.5" />
      ))}
    </>
  ),
  delivery: (
    <>
      <path d="M2 5h12v12H2zM14 9h4l4 4v4h-8" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  returns: (
    <>
      <path d="m8 3-5 5 5 5M3 8h11a7 7 0 0 1 0 14h-3" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-5a9 9 0 1 1 16.6-4.5Z" />
      <path d="M8 10h8M8 14h5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7h14l1 14H4L5 7Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  moon: <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m-6 0 6-6" />
    </>
  ),
  up: <path d="M12 20V4m-6 6 6-6 6 6" />,
};
export default function Icon({ name, ...props }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
