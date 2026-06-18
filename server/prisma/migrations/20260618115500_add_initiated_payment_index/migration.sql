-- Create partial unique index to restrict each booking to at most one active initiated payment intent.
CREATE UNIQUE INDEX "payments_one_initiated_payment_per_booking"
ON "payments" ("booking_id")
WHERE "status" = 'initiated';
