# API Specification — Users & Onboarding Module

This document details endpoints under `/api/v1/users` and `/api/v1/auth/onboarding` which manage customer profiles and onboarding name submission.

---

## 1. User Profiles Endpoints

### 1.1 `GET /users/me`
Retrieves the profile data of the currently authenticated user session.
* **Access**: Protected (requires valid access JWT)
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "Current user retrieved successfully",
    "data": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Customer Name",
      "walletCredits": "0.00",
      "createdAt": "2026-06-17T13:00:00.000Z",
      "updatedAt": "2026-06-17T13:00:00.000Z"
    }
  }
  ```

---

## 2. Onboarding Endpoints

### 2.1 `POST /auth/onboarding`
Completes the customer's onboarding profile by setting their full name.
* **Access**: Protected (requires valid access JWT)
* **Request Payload**:
  ```json
  { "name": "Manish Borikar" }
  ```
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "Onboarding completed successfully",
    "data": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Manish Borikar",
      "onboardingCompletedAt": "2026-06-17T13:05:00.000Z",
      "next_step": "resume_booking"
    }
  }
  ```
* **Errors**: `400 Bad Request` if name is empty or does not meet validation constraints.
