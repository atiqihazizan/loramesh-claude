import express from 'express';
import { authenticateAgencyToken } from '../middleware/auth-agency-token.js';
import {
  checkDevice,
  registerDevice,
  listAgenciesPublic,
  switchAgency,
} from '../services/device-register-service.js';

const router = express.Router();

// GET /api/devices-user/check/:deviceid — PUBLIC (APK semak selepas reinstall)
router.get('/check/:deviceid', async (req, res, next) => {
  try {
    const result = await checkDevice(req.params.deviceid);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// GET /api/devices-user/agencies — PUBLIC (APK senarai agency untuk tukar)
router.get('/agencies', async (req, res, next) => {
  try {
    const agencies = await listAgenciesPublic();
    return res.json({ agencies });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// POST /api/devices-user/switch-agency — PUBLIC (APK tukar agency tanpa QR)
// body: { device_id, agency_id }
router.post('/switch-agency', async (req, res, next) => {
  try {
    const { device_id, deviceid, agency_id } = req.body;
    const id = device_id || deviceid;
    const result = await switchAgency({ deviceId: id, agencyId: agency_id });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// POST /api/devices-user/register — agency token required
router.post('/register', authenticateAgencyToken, async (req, res, next) => {
  try {
    const { deviceid, device_id, name, agency_id } = req.body;
    const id = device_id || deviceid;
    if (!id || !name) {
      return res.status(400).json({ error: 'device_id and name are required' });
    }
    const result = await registerDevice(
      { deviceId: id, name, agencyId: agency_id },
      req.agency,
    );
    return res.status(result.is_new ? 201 : 200).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;