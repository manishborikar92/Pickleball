# API Specification — Authentication Module

This document details endpoints under `/api/v1/auth` which handle both Customer OTP authentication and Staff credential login.

---

## 1. Customer OTP Endpoints

### 1.1 `POST /auth/otp/send`
Sends an OTP to the customer's phone number via Meta WhatsApp API.
* **Access**: Public
* **Rate Limits**: 5 requests per phone per minute.
* **Request Payload**:
  ```json
  { "phone": "+919876543210" }
  ```
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "data": { "phone": "+919876543210", "expires_in_seconds": 300 }
  }
  ```

### 1.2 `POST /auth/otp/verify`
Verifies OTP code, registers the user if they do not exist, and returns a session token.
* **Access**: Public
* **Request Payload**:
  ```json
  { "phone": "+919876543210", "otp": "123456" }
  ```
* **Success Response (200)**:
  * *Cookie Set*: `pb_refresh_token=<opaque-token>; HttpOnly; Path=/api/v1/auth; SameSite=Lax`
  * *Body*:
    ```json
    {
      "success": true,
      "message": "OTP verified successfully",
      "data": {
        "access_token": "<jwt_string>",
        "user": {
          "id": "<uuid>",
          "phone": "+919876543210",
          "name": null,
          "is_new_user": true,
          "onboarding_complete": false
        },
        "next_step": "complete_onboarding"
      }
    }
    ```

---

## 2. Staff Login Endpoints

### 2.1 `POST /auth/staff/login`
Authenticates staff members via email and password credentials.
* **Access**: Public
* **Request Payload**:
  ```json
  { "email": "staff@baselinearena.in", "password": "password123" }
  ```
* **Success Response (200)**:
  * *Cookie Set*: `pb_refresh_token=<opaque-token>; HttpOnly; Path=/api/v1/auth; SameSite=Lax`
  * *Body*:
    ```json
    {
      "success": true,
      "message": "Logged in successfully",
      "data": {
        "access_token": "<jwt_string>",
        "user": {
          "id": "<uuid>",
          "email": "staff@baselinearena.in",
          "name": "Operator Name"
        },
        "next_step": "admin_dashboard"
      }
    }
    ```

---

## 3. Session Management Endpoints

### 3.1 `POST /auth/refresh`
Rotates the opaque refresh token cookie and issues a fresh short-lived access JWT.
* **Access**: Public (requires valid cookie)
* **Success Response (200)**:
  * *Cookie Set*: Rotated cookie value.
  * *Body*:
    ```json
    {
      "success": true,
      "message": "Token refreshed",
      "data": { "access_token": "<jwt_string>" }
    }
    ```

### 3.2 `POST /auth/logout`
Revokes the active refresh token and terminates the current user session.
* **Access**: Public
* **Success Response (200)**:
  * *Cookie Set*: Opaque refresh token cookie expired / deleted.
  * *Body*:
    ```json
    {
      "success": true,
      "message": "Logged out successfully"
    }
    ```

### 3.3 `POST /auth/logout-all`
Revokes all active auth sessions across all devices for the authenticated user.
* **Access**: Protected (requires valid access JWT)
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "All sessions revoked successfully"
  }
  ```
