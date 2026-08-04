const express = require('express');
const {
  getAgenda,
  programarOReagendarVisita,
  checkinVisita,
  checkoutVisita,
} = require('../controllers/agenda.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getAgenda);
router.post('/programar', authenticate, programarOReagendarVisita);
router.post('/checkin', authenticate, checkinVisita);
router.post('/checkout', authenticate, checkoutVisita);

module.exports = router;
