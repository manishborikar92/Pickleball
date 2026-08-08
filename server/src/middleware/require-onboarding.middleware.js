import { getPrisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../utils/api-error.js';

export const requireOnboarding = ({ prisma } = {}) => async (req, _res, next) => {
  try {
    if (!req.auth?.subject) {
      throw new UnauthorizedError('Authentication required');
    }

    const db = prisma || getPrisma();
    const user = await db.user.findUnique({
      where: { id: req.auth.subject },
      select: {
        id: true,
        name: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user?.name || !user.onboardingCompletedAt) {
      throw new ForbiddenError('Onboarding incomplete', { code: 'ONBOARDING_INCOMPLETE' });
    }

    req.auth.user = {
      ...(req.auth.user || {}),
      id: user.id,
      name: user.name,
      onboarding_complete: Boolean(user.onboardingCompletedAt),
    };
    return next();
  } catch (error) {
    return next(error);
  }
};
