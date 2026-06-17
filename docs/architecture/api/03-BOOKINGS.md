# API Specification — Booking Domain (Target Specifications)

This document details the target/planned API contracts for slot holds, availability grids, and price preview.

---

## 1. Availability Endpoints

### 1.1 `GET /bookings/availability`
Retrieves the slot availability grid for all courts at a venue for a specific date.
* **Access**: Public
* **Query Parameters**:
  * `venue_slug` (string, required): e.g. `besa-nagpur`
  * `date` (string, required, ISO YYYY-MM-DD): e.g. `2026-06-20`
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "Availability retrieved successfully",
    "data": {
      "date": "2026-06-20",
      "venue": { "id": "<uuid>", "name": "Besa, Nagpur" },
      "courts": [
        {
          "id": "<uuid>",
          "name": "Court 1",
          "slots": [
            { "startTime": "06:00", "endTime": "07:00", "status": "available" },
            { "startTime": "07:00", "endTime": "08:00", "status": "held" },
            { "startTime": "08:00", "endTime": "09:00", "status": "booked" }
          ]
        }
      ]
    }
  }
  ```

---

## 2. Pricing & Holds Endpoints

### 2.1 `POST /bookings/price-preview`
Calculates an advisory price breakdown for a selected list of courts and slots.
* **Access**: Public
* **Request Payload**:
  ```json
  {
    "venueSlug": "besa-nagpur",
    "date": "2026-06-20",
    "selections": [
      { "courtId": "<uuid>", "slots": ["09:00", "10:00"] }
    ],
    "couponCode": "WELCOME10",
    "useWalletCredits": true
  }
  ```
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "Price preview generated",
    "data": {
      "subtotal": 1200.00,
      "discount": 120.00,
      "creditsDeducted": 50.00,
      "tax": 185.40,
      "total": 1215.40,
      "currency": "INR"
    }
  }
  ```

### 2.2 `POST /bookings/hold`
Locks the selected court slots for 10 minutes to allow the user to complete payment.
* **Access**: Protected (requires valid access JWT + onboarding complete)
* **Request Payload**: Same structure as `price-preview`.
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "message": "Slots locked for 10 minutes",
    "data": {
      "bookingId": "<uuid>",
      "expiresAt": "2026-06-17T13:25:00.000Z",
      "totalAmount": 1215.40,
      "paymentGatewayRedirectUrl": "https://api.phonepe.com/apis/hermes/status/..."
    }
  }
  ```
