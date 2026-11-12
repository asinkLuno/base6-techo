import { BASE_URL } from "../lib/site";

/** V5「一笔六」草案：锁线针脚连成一笔写出 6，起笔留在针眼里。 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path
        d="M 66 23.5 C 64 36 56 47 46 47 A 16 16 0 1 0 62 63"
        strokeWidth="6"
      />
      <circle cx="66" cy="19" r="4.2" strokeWidth="4" />
    </svg>
  );
}

export function Brand() {
  return (
    <a
      href={`${BASE_URL}`}
      className="btn btn-ghost gap-2 px-2 text-base font-semibold tracking-tight"
      aria-label="base6-techo 首页"
    >
      <BrandMark className="text-primary size-7" />
      base6-techo
    </a>
  );
}
