import { createReviewsRepository } from './reviews.repository.js';
import { createReviewsService } from './reviews.service.js';

export const createDefaultReviewsService = ({ authorizationService } = {}) => {
  const repository = createReviewsRepository();
  return createReviewsService({ repository, authorizationService });
};

export { createReviewsRouter } from './reviews.routes.js';
