// middleware/validation.js
// express-validator wrappers + reusable validation chains.

import { body, param, query, validationResult } from 'express-validator';

/**
 * Standard validation result handler. Use as last middleware in chain.
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    error: 'Validation failed',
    details: errors.array().map((e) => ({
      field: e.path,
      value: e.value,
      message: e.msg,
    })),
  });
}

// ============================================
// COMMON / PARAMS
// ============================================
export const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
    .toInt(),
  handleValidationErrors,
];

export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  handleValidationErrors,
];

// ============================================
// AUTH
// ============================================
export const validateLogin = [
  body('username').isString().trim().isLength({ min: 1, max: 50 }),
  body('password').isString().isLength({ min: 1, max: 200 }),
  handleValidationErrors,
];

export const validatePasswordChange = [
  body('current_password').isString().notEmpty(),
  body('new_password')
    .isString()
    .isLength({ min: 6, max: 200 })
    .withMessage('Password must be 6-200 characters'),
  handleValidationErrors,
];

export const validatePasswordReset = [
  body('new_password').isString().isLength({ min: 6, max: 200 }),
  body('force_change').optional().isBoolean().toBoolean(),
  handleValidationErrors,
];

// ============================================
// USERS
// ============================================
export const validateUserCreate = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username: alphanumeric, dot, underscore, dash only'),
  body('password').isString().isLength({ min: 6, max: 200 }),
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('name').optional().isString().trim().isLength({ max: 100 }),
  body('phone_number').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('level_id').optional().isInt({ min: 1 }).toInt(),
  body('agency_id').optional().isInt({ min: 1 }).toInt(),
  handleValidationErrors,
];

export const validateUserUpdate = [
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('name').optional().isString().trim().isLength({ max: 100 }),
  body('phone_number').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('level_id').optional().isInt({ min: 1 }).toInt(),
  body('status').optional().isString().isIn(['online', 'offline', 'disabled', 'banned']),
  handleValidationErrors,
];

// ============================================
// AGENCY
// ============================================
export const validateAgencyCreate = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('code')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Code: uppercase alphanumeric, _, or - only'),
  handleValidationErrors,
];

export const validateAgencySettings = [
  body('default_map_center')
    .optional()
    .isString()
    .matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .withMessage('Format: "lat,lng"'),
  body('default_map_zoom').optional().isInt({ min: 1, max: 22 }).toInt(),
  body('default_tile_provider').optional().isString().isLength({ min: 1, max: 50 }),
  body('tracking_zoom_moving').optional().isInt({ min: 1, max: 22 }).toInt(),
  body('tracking_zoom_stopped').optional().isInt({ min: 1, max: 22 }).toInt(),
  body('tracking_stop_radius_m').optional().isInt({ min: 1, max: 1000 }).toInt(),
  body('session_timeout_hours').optional().isInt({ min: 1, max: 8760 }).toInt(),
  handleValidationErrors,
];

// ============================================
// DEVICE
// ============================================
export const validateDeviceCreate = [
  body('device_id').isString().trim().isLength({ min: 1, max: 100 }),
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('device_mac').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  body('type_id').optional().isInt({ min: 1 }).toInt(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  body('is_static').optional().isBoolean().toBoolean(),
  body('logging_enabled').optional().isBoolean().toBoolean(),
  handleValidationErrors,
];

// ============================================
// SITE
// ============================================
export const validateSiteCreate = [
  body('name').isString().trim().isLength({ min: 1, max: 70 }),
  body('latlng').optional().isString().isLength({ max: 100 }),
  body('zoom').optional().isInt({ min: 1, max: 22 }).toInt(),
  body('slug').optional().isString().isLength({ max: 200 }),
  body('publish').optional().isBoolean().toBoolean(),
  handleValidationErrors,
];