const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/fixedAssetsController');

router.get('/fixed-assets', authMiddleware, ctrl.listFixedAssets);
router.get('/fixed-assets/depreciation-history', authMiddleware, ctrl.depreciationHistory);
router.post('/fixed-assets/depreciate', authMiddleware, ctrl.depreciateMonth);
router.get('/fixed-assets/:id', authMiddleware, ctrl.getAsset);
router.post('/fixed-assets', authMiddleware, ctrl.createFixedAsset);
router.put('/fixed-assets/:id', authMiddleware, ctrl.updateFixedAsset);
router.delete('/fixed-assets/:id', authMiddleware, ctrl.disposeFixedAsset);

module.exports = router;
