interface LogoProps {
  variant?: 'light' | 'dark';
  height?: number;
}

/** The Lumio lockup from the brand kit. `dark` is the reversed version for navy backgrounds. */
export function Logo({ variant = 'light', height = 30 }: LogoProps) {
  const ink = variant === 'dark' ? '#FFFFFF' : '#1C2230';
  return (
    <svg
      viewBox="0 0 470 210"
      height={height}
      role="img"
      aria-label="Lumio"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(14,67) scale(0.54)">
        <path d="M48 152 L128 136 L208 152 L208 186 L128 170 L48 186 Z" fill={ink} />
        <circle cx="128" cy="98" r="23" fill="#F5A623" />
        <path d="M128 62 V38" stroke="#F5A623" strokeWidth="17" strokeLinecap="round" />
        <path d="M172 76 L190 56" stroke="#F5A623" strokeWidth="17" strokeLinecap="round" />
        <path d="M84 76 L66 56" stroke="#F5A623" strokeWidth="17" strokeLinecap="round" />
      </g>
      <text
        x="150"
        y="168"
        fontFamily="Poppins,Inter,sans-serif"
        fontWeight="600"
        letterSpacing="-4"
        fontSize="110"
      >
        <tspan fill={ink}>lum</tspan>
        <tspan fill="#F5A623">io</tspan>
      </text>
    </svg>
  );
}
