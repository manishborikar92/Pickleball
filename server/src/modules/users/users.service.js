export const createUsersService = ({ repository }) => ({
  async getCurrentUser(userId) {
    return repository.getCurrentUser(userId);
  },

  async completeOnboarding({ userId, name }) {
    const user = await repository.completeOnboarding({
      userId,
      name,
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        onboarding_complete: user.onboarding_complete,
      },
      next_step: 'resume_booking',
    };
  },
});
