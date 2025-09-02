const express = require('express');
const router = express.Router();
const { 
  validatePromoCode, 
  createPromoCode, 
  updatePromoCode, 
  deletePromoCode, 
  getAllPromoCodes 
} = require('../controllers/promoCodeController/PromoCodeController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Public route for validating promo codes
router.post('/promo-codes/validate', validatePromoCode);

// Admin-only routes for managing promo codes
router.post('/admin/promo-codes', isAuthenticated, isAdmin, createPromoCode);
router.put('/admin/promo-codes/:id', isAuthenticated, isAdmin, updatePromoCode);
router.delete('/admin/promo-codes/:id', isAuthenticated, isAdmin, deletePromoCode);
router.get('/admin/promo-codes', isAuthenticated, isAdmin, getAllPromoCodes);

module.exports = router;