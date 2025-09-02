const PromoCode = require('../../models/PromoCodes');
const mongoose = require('mongoose');

// Validate Promo Code
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code || !cartTotal || cartTotal < 0) {
      return res.status(400).json({ success: false, message: 'Promo code and valid cart total are required' });
    }

    const promoCode = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promoCode) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive promo code' });
    }

    const currentDate = new Date();
    if (currentDate < promoCode.startDate || currentDate > promoCode.endDate) {
      return res.status(400).json({ success: false, message: 'Promo code has expired' });
    }

    if (promoCode.maxUses > 0 && promoCode.currentUses >= promoCode.maxUses) {
      return res.status(400).json({ success: false, message: 'Promo code usage limit reached' });
    }

    if (cartTotal < promoCode.minOrderValue) {
      return res.status(400).json({ success: false, message: `Cart total must be at least ₹${promoCode.minOrderValue}` });
    }

    let discount = 0;
    if (promoCode.discountType === 'percentage') {
      discount = (cartTotal * promoCode.discountValue) / 100;
    } else if (promoCode.discountType === 'fixed') {
      discount = promoCode.discountValue;
    } else if (promoCode.discountType === 'free_shipping') {
      discount = 0; // Shipping cost handled separately
    } else if (promoCode.discountType === 'bogo') {
      discount = 0; // Discount applied via item quantities
    }

    res.status(200).json({
      success: true,
      message: 'Promo code is valid',
      promoCode: {
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discount: discount,
      },
    });
  } catch (error) {
    console.error('validatePromoCode error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Create Promo Code (Admin)
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderValue,
      startDate,
      endDate,
      maxUses,
      isActive,
    } = req.body;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }

    if (!['percentage', 'fixed', 'free_shipping', 'bogo'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }

    const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({ success: false, message: 'Promo code already exists' });
    }

    const promoCode = new PromoCode({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxUses: maxUses || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    await promoCode.save();

    res.status(201).json({ success: true, message: 'Promo code created', promoCode });
  } catch (error) {
    console.error('createPromoCode error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update Promo Code (Admin)
exports.updatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      discountType,
      discountValue,
      minOrderValue,
      startDate,
      endDate,
      maxUses,
      isActive,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promo code ID' });
    }

    const promoCode = await PromoCode.findById(id);
    if (!promoCode) {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }

    if (code && code.toUpperCase() !== promoCode.code) {
      const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
      if (existingPromo) {
        return res.status(400).json({ success: false, message: 'Promo code already exists' });
      }
      promoCode.code = code.toUpperCase();
    }

    if (discountType) {
      if (!['percentage', 'fixed', 'free_shipping', 'bogo'].includes(discountType)) {
        return res.status(400).json({ success: false, message: 'Invalid discount type' });
      }
      promoCode.discountType = discountType;
    }

    if (discountValue !== undefined) promoCode.discountValue = discountValue;
    if (minOrderValue !== undefined) promoCode.minOrderValue = minOrderValue;
    if (startDate) promoCode.startDate = new Date(startDate);
    if (endDate) promoCode.endDate = new Date(endDate);
    if (maxUses !== undefined) promoCode.maxUses = maxUses;
    if (isActive !== undefined) promoCode.isActive = isActive;

    await promoCode.save();

    res.status(200).json({ success: true, message: 'Promo code updated', promoCode });
  } catch (error) {
    console.error('updatePromoCode error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete Promo Code (Admin)
exports.deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promo code ID' });
    }

    const promoCode = await PromoCode.findByIdAndDelete(id);
    if (!promoCode) {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }

    res.status(200).json({ success: true, message: 'Promo code deleted' });
  } catch (error) {
    console.error('deletePromoCode error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get All Promo Codes (Admin)
exports.getAllPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, promoCodes });
  } catch (error) {
    console.error('getAllPromoCodes error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};