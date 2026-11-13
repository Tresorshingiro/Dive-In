import type { MyMembership } from '@dive/shared';
import { CardFront, CardReceptionView, type CardData } from '../../components/MembershipCard';
import { shortDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

export function toCardData(m: MyMembership, memberName: string): CardData {
  return {
    memberName,
    gymName: m.gym.name,
    plan: m.package.name,
    expires: m.status === 'AWAITING_PAYMENT' ? 'On payment' : shortDate(m.endsAt),
    number: m.number,
    status: m.status,
  };
}

/** The member's real card. Flips to show what reception will see for this live record. */
export function MemberCard({ m, flippable = true }: { m: MyMembership; flippable?: boolean }) {
  const { user } = useAuth();
  const [flipped, setFlipped] = useState(false);
  const data = toCardData(m, user!.fullName);
  if (!flippable)
    return (
      <div className="h-[230px] sm:h-[280px]">
        <CardFront data={data} />
      </div>
    );
  return (
    <button type="button" className="flipwrap block w-full border-0 bg-transparent p-0 text-left text-text" data-flipped={flipped} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Show card' : 'Show what reception sees'}>
      <div className="flip h-[250px] sm:h-[300px]">
        <div className="face">
          <CardFront data={data} />
        </div>
        <div className="face face-back">
          <CardReceptionView data={data} />
        </div>
      </div>
    </button>
  );
}
