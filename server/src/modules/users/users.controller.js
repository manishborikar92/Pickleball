import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createUsersController = ({ userService }) => ({
  currentUser: asyncHandler(async (req, res) => {
    const user = await userService.getCurrentUser(req.auth.subject);
    res.json(ApiResponse.success(user));
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const user = await userService.updateProfile({
      userId: req.auth.subject,
      name: req.validated.body.name,
    });

    res.json(ApiResponse.success(user, 'Profile updated'));
  }),

  myBookings: asyncHandler(async (req, res) => {
    const result = await userService.getMyBookings({
      userId: req.auth.subject,
      status: req.validated.query.status,
      page: req.validated.query.page,
      limit: req.validated.query.limit,
    });
    res.json(ApiResponse.success(result));
  }),

  myWallet: asyncHandler(async (req, res) => {
    const result = await userService.getMyWallet({
      userId: req.auth.subject,
    });
    res.json(ApiResponse.success(result));
  }),

  completeOnboarding: asyncHandler(async (req, res) => {
    const result = await userService.completeOnboarding({
      userId: req.auth.subject,
      name: req.validated.body.name,
    });

    res.json(ApiResponse.success(result, 'Onboarding completed'));
  }),
});
