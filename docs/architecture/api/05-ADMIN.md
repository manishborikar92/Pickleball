# API Specification — Administrative Module (Target Specifications)

This document details target administrative and operator endpoints. All administrative routes require valid staff authentication and specific permission keys.

---

## 1. Staff Provisioning Endpoints

### 1.1 `POST /admin/staff`
Super Admin provisions a new staff member account.
* **Access**: Protected (requires `requirePermission('manage_venues')`)
* **Request Payload**:
  ```json
  {
    "email": "manager@baselinearena.in",
    "name": "Manager Name",
    "roleId": "<role_uuid>",
    "venueId": "<venue_uuid>"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "message": "Staff user provisioned. Activation email sent.",
    "data": {
      "userId": "<user_uuid>",
      "email": "manager@baselinearena.in",
      "status": "pending_activation"
    }
  }
  ```

---

## 2. Walk-in and Block Overrides

### 2.1 `POST /admin/bookings/walk-in`
Registers a cash or manual UPI walk-in booking, bypassing the PhonePe checkouts.
* **Access**: Protected (requires `requirePermission('walk_in_entry')`)
* **Request Payload**:
  ```json
  {
    "venueId": "<uuid>",
    "courtId": "<uuid>",
    "date": "2026-06-20",
    "slots": ["14:00", "15:00"],
    "playerPhone": "+919999999999",
    "playerName": "Walk-in Player Name"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "message": "Walk-in booking created",
    "data": { "bookingId": "<uuid>", "status": "walk_in" }
  }
  ```

### 2.2 `POST /admin/bookings/block`
Blocks a set of slots for maintenance or coaching blocks.
* **Access**: Protected (requires `requirePermission('manage_bookings')`)
* **Request Payload**:
  ```json
  {
    "venueId": "<uuid>",
    "courtId": "<uuid>",
    "date": "2026-06-20",
    "slots": ["10:00", "11:00"],
    "reason": "Court maintenance"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "message": "Slots blocked successfully",
    "data": { "bookingId": "<uuid>", "status": "admin_block" }
  }
  ```
