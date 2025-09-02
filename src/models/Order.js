const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  }],
  item_quantities: [{
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    desiredSize: {
      type: String,
    },
  }],
  total_price: {
    type: Number,
    required: true,
  },
  payment_status: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending',
  },
  razorpay_order_id: {
    type: String,
  },
  razorpay_payment_id: {
    type: String,
  },
  razorpay_signature: {
    type: String,
  },
  order_status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  shipping_status: {
    type: String,
    enum: ['Pending', 'Shipped', 'In Transit', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  address: {
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    state: String,
    country: String,
    pinCode: String,
    phoneNumber: String,
  },
  shiprocket_orderId: {
    type: String,
  },
  shiprocket_shipment_id: {
    type: String,
  },
  awb_code: {
    type: String,
  },
  tracking_url: {
    type: String,
  },
  courier_company_id: {
    type: String,
  },
  courier_name: {
    type: String,
  },
  freight_charges: {
    type: Number,
  },
  applied_weight: {
    type: Number,
  },
  routing_code: {
    type: String,
  },
  invoice_no: {
    type: String,
  },
  transporter_id: {
    type: String,
  },
  transporter_name: {
    type: String,
  },
  shipped_by: {
    shipper_company_name: String,
    shipper_address_1: String,
    shipper_address_2: String,
    shipper_city: String,
    shipper_state: String,
    shipper_country: String,
    shipper_postcode: String,
    shipper_phone: String,
    shipper_email: String,
  },
  refund: {
    requestDate: Date,
    status: String,
    rmaNumber: String,
    amount: Number,
    reason: String,
    returnAwbCode: String,
    returnTrackingUrl: String,
    returnLabelUrl: String,
    shiprocketReturnId: String,
    returnShipmentId: String,
    refundTransactionId: String,
    refundStatus: String,
    notes: String,
    images: [String],
  },
  exchange: {
    requestDate: Date,
    status: String,
    rmaNumber: String,
    newItemId: String,
    desiredSize: String,
    reason: String,
    returnAwbCode: String,
    returnTrackingUrl: String,
    returnLabelUrl: String,
    shiprocketReturnId: String,
    returnShipmentId: String,
    forwardAwbCode: String,
    forwardTrackingUrl: String,
    shiprocketForwardOrderId: String,
    forwardShipmentId: String,
    notes: String,
    images: [String],
  },
  promoCode: {
    type: String,
    trim: true,
  },
  promoDiscount: {
    type: Number,
    default: 0,
    min: 0,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', orderSchema);