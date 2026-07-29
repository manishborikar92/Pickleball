import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createNotificationsController = ({ notificationsService }) => ({
  getSettings: asyncHandler(async (req, res) => {
    const result = await notificationsService.getNotificationSettings({
      venueId: req.validated.query.venue_id,
    });
    res.json(ApiResponse.success(result, 'Notification settings'));
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const { venue_id: venueId, ...input } = req.validated.body;
    const result = await notificationsService.updateNotificationSettings({
      userId: req.auth.subject,
      venueId,
      input,
    });
    res.json(ApiResponse.success(result, 'Notification settings updated'));
  }),

  getLog: asyncHandler(async (req, res) => {
    const result = await notificationsService.getNotificationLog({
      venueId: req.validated.query.venue_id,
      status: req.validated.query.status,
      type: req.validated.query.type,
      page: req.validated.query.page,
      limit: req.validated.query.limit,
    });
    res.json(
      ApiResponse.paginated(result.data, result.pagination, 'Notification log', {
        summary: result.summary,
      }),
    );
  }),
});
