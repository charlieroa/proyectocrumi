// src/routes/pygFuncionRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/pygFuncionController');

router.use(authMiddleware);
router.get('/income-statement/by-function', ctrl.getIncomeStatementByFunction);

module.exports = router;
