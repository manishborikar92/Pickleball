import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createVenuesController = ({ venueService }) => ({
  getById: asyncHandler(async (req, res) => {
    const venue = await venueService.getVenueById(req.validated.params.venueId);
    res.json(ApiResponse.success(venue));
  }),

  getBySlug: asyncHandler(async (req, res) => {
    const venue = await venueService.getVenueBySlug(req.validated.params.slug);
    res.json(ApiResponse.success(venue));
  }),

  getAvailability: asyncHandler(async (req, res) => {
    const result = await venueService.getAvailability({
      venueId: req.validated.params.venueId,
      date: req.validated.query.date,
    });
    res.json(ApiResponse.success(result));
  }),
});
