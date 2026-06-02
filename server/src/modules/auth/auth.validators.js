import Joi from 'joi';

export const sendOtpSchema = Joi.object({
  phone: Joi.string().min(10).max(20).required(),
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().min(10).max(20).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
});

export const staffLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});
