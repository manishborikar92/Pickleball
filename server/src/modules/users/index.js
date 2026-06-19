import { createUsersRepository } from './users.repository.js';
import { createUsersService } from './users.service.js';
import { createUsersRouter } from './users.routes.js';

export const createDefaultUsersService = () => {
  const repository = createUsersRepository();
  return createUsersService({ repository });
};

export const createDefaultUsersRouter = ({ userService } = {}) => createUsersRouter({
  userService,
});
