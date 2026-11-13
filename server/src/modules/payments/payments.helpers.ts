import type { PaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { providerByName } from '../../payments';

/** Cancels unpaid checkouts for a target (also expiring the provider session) so they can't be paid any more. */
export async function cancelOpenPaymentsFor(purpose: PaymentPurpose, targetId: string, reason: string) {
  const open = await prisma.payment.findMany({ where: { purpose, targetId, status: 'PENDING' } });
  for (const p of open) {
    if (p.providerRef) await providerByName(p.provider)?.cancel(p.providerRef);
    await prisma.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CANCELLED', failureReason: reason } });
  }
}
