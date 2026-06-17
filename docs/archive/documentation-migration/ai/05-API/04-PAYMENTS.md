# API Specification — Payments Domain (Target Specifications)

This document outlines the target API contracts and webhook formats for PhonePe UPI Integration.

---

## 1. Webhook Notification

### 1.1 `POST /payments/webhook`
PhonePe sends POST payloads containing base64-encoded transaction payloads to this endpoint. The endpoint verifies signature checksums using the PhonePe salt key before modifying transaction states.
* **Access**: Public (requires PhonePe custom header validation)
* **Headers**:
  * `X-VERIFY`: Checksum signature generated using SHA256 of `(Base64 Payload + "/pg/v1/pay" + Salt Key) + "###" + Salt Index`
* **Request Payload**:
  ```json
  {
    "response": "<base64_encoded_payment_status_payload>"
  }
  ```
* **Decoded Payload format**:
  ```json
  {
    "success": true,
    "code": "PAYMENT_SUCCESS",
    "message": "Payment completed successfully",
    "data": {
      "merchantId": "MERCHANT_ID",
      "merchantTransactionId": "TXN_BOOKING_123456",
      "transactionId": "T260617130000000001",
      "amount": 121540,
      "state": "COMPLETED",
      "responseCode": "SUCCESS",
      "paymentInstrument": {
        "type": "UPI",
        "utr": "6017130001"
      }
    }
  }
  ```
* **Success Response (200)**:
  * Backend must respond with HTTP `200` to acknowledge receipt. Response body shape is simple:
    ```json
    { "success": true, "message": "Webhook processed" }
    ```

---

## 2. Status Inquiry

### 2.1 `GET /payments/status/:bookingId`
Queries the database transaction status of a booking to check if payment is completed.
* **Access**: Protected (requires valid access JWT)
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "message": "Payment status checked",
    "data": {
      "bookingId": "<uuid>",
      "status": "success",
      "amount": 1215.40,
      "instrument": "UPI"
    }
  }
  ```
* **Errors**: `404 Not Found` if booking record does not exist.
