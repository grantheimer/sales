export default function Logo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      {/* Palm Tree Icon */}
      <g fill="url(#logoGradient)">
        {/* Trunk */}
        <path d="M12 28C12 28 13 20 14 16C15 12 14 10 14 10L16 10C16 10 15 12 16 16C17 20 18 28 18 28H12Z" />

        {/* Left fronds */}
        <path d="M15 11C15 11 8 8 4 10C0 12 1 14 1 14C1 14 4 12 8 11C12 10 15 11 15 11Z" />
        <path d="M14 9C14 9 9 4 5 4C1 4 0 6 0 6C0 6 3 5 7 6C11 7 14 9 14 9Z" />
        <path d="M14 7C14 7 11 2 8 1C5 0 3 1 3 1C3 1 6 1 9 3C12 5 14 7 14 7Z" />

        {/* Right fronds */}
        <path d="M15 11C15 11 22 8 26 10C30 12 29 14 29 14C29 14 26 12 22 11C18 10 15 11 15 11Z" />
        <path d="M16 9C16 9 21 4 25 4C29 4 30 6 30 6C30 6 27 5 23 6C19 7 16 9 16 9Z" />
        <path d="M16 7C16 7 19 2 22 1C25 0 27 1 27 1C27 1 24 1 21 3C18 5 16 7 16 7Z" />
      </g>

      {/* ArubaCRM Text */}
      <text
        x="36"
        y="22"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="18"
        fontWeight="700"
        fill="url(#logoGradient)"
      >
        ArubaCRM
      </text>
    </svg>
  );
}
