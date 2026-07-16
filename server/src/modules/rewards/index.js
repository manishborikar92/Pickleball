import { createRewardsRepository } from './rewards.repository.js';
import { createRewardIssuanceService, createRewardsService } from './rewards.service.js';

export const createDefaultRewardsService = ({ authorizationService } = {}) => {
  const repository = createRewardsRepository();
  return createRewardsService({ repository, authorizationService });
};

export const createDefaultRewardIssuanceService = () => {
  const repository = createRewardsRepository();
  return createRewardIssuanceService({ repository });
};

export { createRewardsRouter } from './rewards.routes.js';
export { createRewardIssuanceService, createRewardsService } from './rewards.service.js';
export { createRewardsRepository } from './rewards.repository.js';
