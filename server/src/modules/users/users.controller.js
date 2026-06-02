import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createUsersController = ({ userService }) => ({
  currentUser: asyncHandler(async (req, res) => {
    const user = await userService.getCurrentUser(req.auth.subject);
    res.json(ApiResponse.success(user));
  }),

  completeOnboarding: asyncHandler(async (req, res) => {
    const result = await userService.completeOnboarding({
      userId: req.auth.subject,
      name: req.validated.body.name,
    });

    res.json(ApiResponse.success(result, 'Onboarding completed'));
  }),
});
