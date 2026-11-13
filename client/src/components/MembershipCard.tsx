import { motion, useReducedMotion } from 'framer-motion';
import type { MembershipStatus } from '@dive/shared';
import { StatusPill } from './ui/StatusPill';

export interface CardData {
  memberName: string;
  gymName: string;
  plan: string;
  expires: string;
  number: string;
  status: MembershipStatus;
}

/** The light sweep across the card face. */
export function Shine({ delay = 1.5 }: { delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 w-[40%]"
      style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)' }}
      initial={{ left: '-50%' }}
      animate={{ left: ['-50%', '130%'] }}
      transition={{ duration: 2.3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5, delay }}
    />
  );
}

/** Front of the premium black-and-gold card. No QR code, by design. */
export function CardFront({ data, size = 'lg' }: { data: CardData; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div
      className={`relative flex h-full flex-col justify-between overflow-hidden ${lg ? 'rounded-[22px] p-6 sm:p-8' : 'rounded-[22px] p-[22px]'}`}
      style={{
        background: `linear-gradient(140deg,${lg ? '#2B2318' : '#262017'} 0%,${lg ? '#151515' : '#141414'} 55%,#0B0B0B 100%)`,
        border: '1px solid #4A3F28',
        boxShadow: lg ? '0 50px 90px -40px rgba(0,0,0,.9)' : '0 40px 80px -30px rgba(0,0,0,.9)',
      }}
    >
      <Shine />
      <div className="flex items-start justify-between">
        <div>
          <div className={`disp text-gold ${lg ? 'text-[40px]' : 'text-[26px]'}`}>Dive-In</div>
          <div className={`mt-1 tracking-[.2em] text-muted ${lg ? 'text-[11px]' : 'text-[10px]'}`}>MEMBERSHIP CARD</div>
        </div>
        <StatusPill status={data.status} size={lg ? 'lg' : 'sm'} />
      </div>
      <div>
        <div className={`font-semibold ${lg ? 'text-2xl' : 'text-lg'}`}>{data.memberName}</div>
        {lg ? (
          <div className="mt-[18px] grid grid-cols-3 gap-3 text-xs text-muted">
            <div>
              GYM<div className="mt-1 truncate text-sm text-text">{data.gymName}</div>
            </div>
            <div>
              PLAN<div className="mt-1 truncate text-sm text-text">{data.plan}</div>
            </div>
            <div>
              EXPIRES<div className="mt-1 text-sm text-text">{data.expires}</div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex justify-between text-xs text-muted">
            <span>
              {data.gymName} · {data.plan}
            </span>
            <span>{data.number}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** What reception sees: the live record, not the card. */
export function CardReceptionView({ data }: { data: CardData }) {
  const statusColor = data.status === 'ACTIVE' ? '#1C7C43' : data.status === 'AWAITING_PAYMENT' ? '#9A6B00' : '#B42318';
  const statusLabel = data.status === 'AWAITING_PAYMENT' ? 'Awaiting payment' : data.status.charAt(0) + data.status.slice(1).toLowerCase();
  return (
    <div className="flex h-full flex-col justify-between rounded-[22px] bg-text p-6 text-[#111] sm:p-8">
      <div className="text-xs font-bold tracking-[.16em] text-[#6B665C]">RECEPTION VIEW · LIVE RECORD</div>
      <div className="flex flex-col gap-3 text-[15px]">
        <div className="flex justify-between gap-4">
          <span className="text-[#555]">Membership no.</span>
          <strong>{data.number}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#555]">Payment</span>
          <strong>{data.status === 'AWAITING_PAYMENT' ? 'Not yet verified' : 'Verified by provider'}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#555]">Status</span>
          <strong style={{ color: statusColor }}>{statusLabel}</strong>
        </div>
      </div>
      <span className="grid h-[52px] place-items-center rounded-[14px] bg-[#111] font-semibold text-text">
        {data.status === 'ACTIVE' ? 'Record check-in' : 'Entry not allowed'}
      </span>
    </div>
  );
}
