const express = require('express');
const { requireAuth } = require('../lib');
const { getStatus, syncCompanyToFirestore, restoreCompanyFromFirestore } = require('../firebase');

const router = express.Router();
router.use(requireAuth);

/* Only company admin can manage Firebase sync */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.is_superadmin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// GET /api/firebase/status — check configuration & connection status
router.get('/status', (req, res) => {
  const status = getStatus();
  res.json({ status });
});

// POST /api/firebase/sync — trigger immediate cloud backup to Firestore
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const result = await syncCompanyToFirestore(req.user.company_id);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('Firebase sync error:', err.message);
    res.status(500).json({ error: 'firebase_sync_failed', message: err.message });
  }
});

// POST /api/firebase/restore — restore from latest cloud snapshot
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const result = await restoreCompanyFromFirestore(req.user.company_id);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('Firebase restore error:', err.message);
    res.status(500).json({ error: 'firebase_restore_failed', message: err.message });
  }
});

module.exports = router;
