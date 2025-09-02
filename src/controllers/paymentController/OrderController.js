const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require('mongoose');
const Order = require("../../models/Order");
const Item = require("../../models/Item");
const ItemDetails = require("../../models/ItemDetails");
const PromoCode = require("../../models/PromoCodes");

const razorpay = new Razorpay({
  key_id: "rzp_live_VRU7ggfYLI7DWV",
  key_secret: "giunOIOED3FhjWxW2dZ2peNe",
});

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_EMAIL = "support@yoraa.in";
const SHIPROCKET_PASSWORD = "R@2727thik";

async function getShiprocketToken() {
  try {
    const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Authentication failed");
    return data.token;
  } catch (error) {
    console.error("Shiprocket Auth Error:", error);
    throw new Error("Failed to authenticate with Shiprocket");
  }
}

async function checkCourierServiceability(token, pickupPincode, deliveryPincode) {
  try {
    const serviceabilityResponse = await fetch(`${SHIPROCKET_API_BASE}/courier/serviceability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPincode,
        weight: 0.5,
        cod: 0,
      }),
    });

    const serviceabilityData = await serviceabilityResponse.json();
    console.log("Courier Serviceability Response:", JSON.stringify(serviceabilityData, null, 2));
    if (serviceabilityResponse.status === 200 && serviceabilityData.data.available_courier_companies.length > 0) {
      return { success: true, couriers: serviceabilityData.data.available_courier_companies };
    } else {
      return { success: false, message: "No courier available for this route" };
    }
  } catch (error) {
    console.error("Error checking courier serviceability:", error);
    return { success: false, message: "Error checking courier serviceability", error: error.message };
  }
}

async function checkShiprocketWalletBalance(token) {
  try {
    const balanceResponse = await fetch(`${SHIPROCKET_API_BASE}/wallet/balance`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const balanceData = await balanceResponse.json();
    if (balanceData.data && balanceData.data.available_balance !== undefined) {
      const balance = balanceData.data.available_balance;
      if (balance < 100) {
        return {
          success: false,
          message: "Insufficient Shiprocket wallet balance",
          error: `Available balance is Rs ${balance}. Minimum required balance is Rs 100.`,
        };
      }
      return { success: true, balance };
    } else {
      return {
        success: false,
        message: "Failed to fetch Shiprocket wallet balance",
        error: balanceData.message || "Unknown error",
      };
    }
  } catch (error) {
    console.error("Error checking Shiprocket wallet balance:", error);
    return { success: false, message: "Error checking Shiprocket wallet balance", error: error.message };
  }
}

async function generateAWBWithCourier(shipmentId, token) {
  try {
    const awbResponse = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ shipment_id: shipmentId }),
    });

    const awbData = await awbResponse.json();
    console.log("AWB Assignment Response:", JSON.stringify(awbData, null, 2));
    if (awbResponse.ok && awbData.awb_assign_status === 1) {
      return {
        success: true,
        message: "AWB generated successfully",
        awbData: awbData.response.data,
      };
    } else {
      console.error("Failed to generate AWB:", awbData);
      if (awbData.status_code === 350) {
        return {
          success: false,
          message: "Insufficient Shiprocket wallet balance",
          error: "Please recharge your Shiprocket wallet. Minimum required balance is Rs 100.",
        };
      }
      return {
        success: false,
        message: "AWB generation failed",
        error: awbData?.message || "Unknown error",
      };
    }
  } catch (error) {
    console.error("Error generating AWB:", error);
    return { success: false, message: "Error generating AWB", error: error.message };
  }
}

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, cart, staticAddress, promoCode } = req.body;
    const userId = req.user._id;

    console.log("amount:", amount);
    console.log("cart:", cart);
    console.log("address:", staticAddress);
    console.log("promoCode:", promoCode);
    console.log("userId:", userId);

    // Validate cart data
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty or invalid" });
    }

    // Extract item IDs and SKUs from cart
    const itemIds = cart.map(cartItem => cartItem.itemId);
    const skus = cart.map(cartItem => cartItem.sku);

    // Validate itemIds
    if (!itemIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid item IDs" });
    }

    // Check if all items exist
    const existingItems = await Item.find({ _id: { $in: itemIds } });
    if (existingItems.length !== itemIds.length) {
      return res.status(400).json({ error: "One or more items not found" });
    }

    // Validate SKUs in ItemDetails
    const itemDetails = await ItemDetails.find({ items: { $in: itemIds } });
    for (const cartItem of cart) {
      const detail = itemDetails.find(d => d.items.toString() === cartItem.itemId);
      if (!detail) {
        return res.status(400).json({ error: `ItemDetails not found for item ${cartItem.itemId}` });
      }
      const skuExists = detail.colors.some(color =>
        color.sizes.some(size => size.sku === cartItem.sku)
      );
      if (!skuExists) {
        return res.status(400).json({ error: `Invalid SKU ${cartItem.sku} for item ${cartItem.itemId}` });
      }
    }

    // Calculate original cart total
    let cartTotal = 0;
    for (const cartItem of cart) {
      const item = existingItems.find(i => i._id.toString() === cartItem.itemId);
      cartTotal += item.price * cartItem.quantity;
    }

    // Assume shipping cost (adjust based on your logic)
    const shippingCost = cartTotal > 500 ? 0 : 50; // Example: Free shipping above ₹500
    let totalAmount = cartTotal + shippingCost;

    // Validate and apply promo code
    let promoDiscount = 0;
    let modifiedCart = [...cart];
    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true });
      if (!promo) {
        return res.status(400).json({ error: "Invalid or inactive promo code" });
      }

      const currentDate = new Date();
      if (currentDate < promo.startDate || currentDate > promo.endDate) {
        return res.status(400).json({ error: "Promo code has expired" });
      }

      if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
        return res.status(400).json({ error: "Promo code usage limit reached" });
      }

      if (cartTotal < promo.minOrderValue) {
        return res.status(400).json({ error: `Cart total must be at least ₹${promo.minOrderValue}` });
      }

      if (promo.discountType === 'percentage') {
        promoDiscount = (cartTotal * promo.discountValue) / 100;
      } else if (promo.discountType === 'fixed') {
        promoDiscount = promo.discountValue;
      } else if (promo.discountType === 'free_shipping') {
        promoDiscount = shippingCost;
      } else if (promo.discountType === 'bogo') {
        // Find the cheapest item to duplicate
        const cheapestItem = existingItems.reduce((min, item) => {
          return min.price < item.price ? min : item;
        }, existingItems[0]);
        const cheapestCartItem = cart.find(c => c.itemId === cheapestItem._id.toString());
        modifiedCart.push({
          itemId: cheapestItem._id.toString(),
          sku: cheapestCartItem.sku,
          quantity: cheapestCartItem.quantity,
        });
        promoDiscount = cheapestItem.price * cheapestCartItem.quantity;
      }

      totalAmount = cartTotal + shippingCost - promoDiscount;
    }

    // Validate provided amount
    if (Math.abs(totalAmount - amount) > 0.01) {
      return res.status(400).json({ error: `Provided amount (${amount}) does not match calculated total (${totalAmount})` });
    }

    const options = {
      amount: totalAmount * 100, // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    // Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create(options);

    // Prepare item_quantities with SKUs
    const itemQuantities = modifiedCart.map(cartItem => ({
      item_id: cartItem.itemId,
      sku: cartItem.sku,
      quantity: cartItem.quantity,
    }));

    // Save Order in Database
    const newOrder = new Order({
      user: userId,
      items: itemIds,
      total_price: totalAmount,
      payment_status: "Pending",
      razorpay_order_id: razorpayOrder.id,
      address: staticAddress,
      item_quantities: itemQuantities,
      promoCode: promoCode ? promoCode.toUpperCase() : null,
      promoDiscount,
    });

    await newOrder.save();

    res.json({
      ...razorpayOrder,
      calculatedTotal: totalAmount,
      promoDiscount,
      shippingCost,
    });
    console.log("order created:", newOrder);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Error creating Razorpay order", details: error.message });
  }
};

// Verify Payment & Create Shiprocket Order
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Verify Razorpay Payment Signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", "giunOIOED3FhjWxW2dZ2peNe")
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // Update Order Payment Status
    let order = await Order.findOneAndUpdate(
      { razorpay_order_id },
      {
        $set: {
          payment_status: "Paid",
          razorpay_payment_id,
          razorpay_signature,
        },
      },
      { new: true }
    ).populate("items").populate("user");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Increment promo code usage if applied
    if (order.promoCode) {
      const promo = await PromoCode.findOneAndUpdate(
        { code: order.promoCode, isActive: true },
        { $inc: { currentUses: 1 } },
        { new: true }
      );
      if (!promo) {
        console.warn(`Promo code ${order.promoCode} not found or inactive during payment verification`);
      }
    }

    // Track stock updates for Items to avoid multiple queries
    const itemStockUpdates = new Map();

    // Decrease Stock for Each Item in ItemDetails and Aggregate for Item
    for (const entry of order.item_quantities) {
      const itemId = entry.item_id;
      const sku = entry.sku;
      const quantity = entry.quantity;

      // Fetch ItemDetails for the item
      const itemDetails = await ItemDetails.findOne({ items: itemId });
      if (!itemDetails) {
        throw new Error(`ItemDetails not found for item ID: ${itemId}`);
      }

      // Find the size entry by SKU and update stock
      let updated = false;
      for (const color of itemDetails.colors) {
        const sizeEntry = color.sizes.find(s => s.sku === sku);
        if (sizeEntry) {
          if (sizeEntry.stock < quantity) {
            throw new Error(
              `Insufficient stock for SKU ${sku} of item ID: ${itemId}. Available: ${sizeEntry.stock}, Requested: ${quantity}`
            );
          }
          sizeEntry.stock -= quantity;
          updated = true;
          break;
        }
      }
      if (!updated) {
        throw new Error(`SKU ${sku} not found for item ID: ${itemId}`);
      }

      // Aggregate quantity for Item stock update
      if (itemStockUpdates.has(itemId.toString())) {
        itemStockUpdates.set(itemId.toString(), itemStockUpdates.get(itemId.toString()) + quantity);
      } else {
        itemStockUpdates.set(itemId.toString(), quantity);
      }

      await itemDetails.save();
    }

    // Update stock in Item model
    for (const [itemId, quantity] of itemStockUpdates) {
      const item = await Item.findById(itemId);
      if (!item) {
        throw new Error(`Item not found for ID: ${itemId}`);
      }
      if (item.stock < quantity) {
        throw new Error(
          `Insufficient stock for item ID: ${itemId}. Available: ${item.stock}, Requested: ${quantity}`
        );
      }
      item.stock -= quantity;
      await item.save();
    }

    // Get Shiprocket API Token
    const token = await getShiprocketToken();
    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to authenticate Shiprocket" });
    }

    // Calculate shipping cost (same logic as in createOrder)
    const cartTotal = order.items.reduce((total, item) => total + (item.price * order.item_quantities.find(q => q.item_id.toString() === item._id.toString()).quantity), 0);
    const shippingCost = order.promoCode && order.promoCode.discountType === 'free_shipping' ? 0 : (cartTotal > 500 ? 0 : 50);

    // Create Order in Shiprocket
    const totalWeight = Math.max(
      order.items.reduce((total, item) => total + (item.weight || 0.5), 0),
      0.5
    );
    const maxLength = Math.max(...order.items.map((item) => item.length ?? 0.5), 0.5);
    const maxBreadth = Math.max(...order.items.map((item) => item.breadth ?? 0.5), 0.5);
    const maxHeight = Math.max(...order.items.map((item) => item.height ?? 0.5), 0.5);

    const shiprocketResponse = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        order_id: order._id.toString(),
        order_date: new Date().toISOString(),
        pickup_location: "warehouse",
        billing_customer_name: order.address.firstName || "Guest",
        billing_last_name: order.address.lastName || "N/A",
        billing_address: order.address.address,
        billing_city: order.address.city,
        billing_pincode: order.address.pinCode,
        billing_state: order.address.state,
        billing_country: order.address.country || "India",
        billing_email: order.user?.email || "customer@example.com",
        billing_phone: order.user?.phNo || "9999999999",
        shipping_is_billing: true,
        payment_method: "Prepaid",
        sub_total: order.total_price,
        length: maxLength,
        breadth: maxBreadth,
        height: maxHeight,
        weight: totalWeight,
        order_items: order.item_quantities.map((entry) => {
          const item = order.items.find((i) => i._id.toString() === entry.item_id.toString());
          return {
            name: item ? item.name : "Unknown Item",
            sku: entry.sku,
            units: entry.quantity,
            selling_price: item ? item.price : 0,
          };
        }),
      }),
    });

    const shiprocketData = await shiprocketResponse.json();
    if (shiprocketData.status_code === 1) {
      order.shiprocket_shipment_id = shiprocketData.shipment_id;
      order.shiprocket_orderId = shiprocketData.order_id;
      await order.save();

      const awbResponse = await generateAWBWithCourier(shiprocketData.shipment_id, token);
      if (awbResponse.success) {
        const awbData = awbResponse.awbData;
        if (!awbData || !awbData.awb_code) {
          console.error("Invalid AWB data structure:", awbData);
          throw new Error("Failed to retrieve AWB code");
        }
        order.awb_code = awbData.awb_code;
        order.shiprocket_shipment_id = awbData.shipment_id;
        order.tracking_url = `https://shiprocket.co/tracking/${awbData.awb_code}`;
        order.courier_company_id = awbData.courier_company_id;
        order.courier_name = awbData.courier_name;
        order.freight_charges = awbData.freight_charges;
        order.applied_weight = awbData.applied_weight;
        order.routing_code = awbData.routing_code;
        order.invoice_no = awbData.invoice_no;
        order.transporter_id = awbData.transporter_id;
        order.transporter_name = awbData.transporter_name;
        order.shipped_by = {
          shipper_company_name: awbData.shipped_by.shipper_company_name,
          shipper_address_1: awbData.shipped_by.shipper_address_1,
          shipper_address_2: awbData.shipped_by.shipper_address_2,
          shipper_city: awbData.shipped_by.shipper_city,
          shipper_state: awbData.shipped_by.shipper_state,
          shipper_country: awbData.shipped_by.shipper_country,
          shipper_postcode: awbData.shipped_by.shipper_postcode,
          shipper_phone: awbData.shipped_by.shipper_phone,
          shipper_email: awbData.shipped_by.shipper_email,
        };
        await order.save();
        return res.json({
          success: true,
          message: "Payment verified, Shiprocket order created & AWB generated!",
          order,
          shiprocketOrderId: shiprocketData.order_id,
          awbCode: awbData.awb_code,
        });
      } else {
        console.error("AWB generation failed:", awbResponse.error);
        return res.json({
          success: true,
          message: "Payment verified and Shiprocket order created, but AWB generation failed",
          order,
          shiprocketOrderId: shiprocketData.order_id,
          awbCode: "AWB generation failed",
        });
      }
    } else {
      throw new Error("Shiprocket order creation failed: " + JSON.stringify(shiprocketData));
    }
  } catch (error) {
    console.error("Payment verification error:", error);

    let order = await Order.findOne({ razorpay_order_id: req.body.razorpay_order_id });
    if (error.message.includes("Insufficient stock") && req.body.razorpay_payment_id && order) {
      try {
        const refund = await razorpay.payments.refund(req.body.razorpay_payment_id, {
          amount: order.total_price * 100,
          speed: "optimum",
        });
        console.log("Refund initiated due to insufficient stock:", refund);
      } catch (refundError) {
        console.error("Refund failed:", refundError);
      }
    }

    res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.shipping_status === "Delivered") {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled as it is already delivered" });
    }

    if (order.shiprocket_orderId) {
      const shiprocketToken = await getShiprocketToken();
      if (!shiprocketToken) {
        return res.status(500).json({ success: false, message: "Failed to authenticate with Shiprocket" });
      }

      const cancelShiprocket = await fetch(`${SHIPROCKET_API_BASE}/orders/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${shiprocketToken}`,
        },
        body: JSON.stringify({ ids: [order.shiprocket_orderId] }),
      });

      const cancelData = await cancelShiprocket.json();
      if (!cancelShiprocket.ok || !cancelData.success) {
        return res.status(500).json({ success: false, message: "Failed to cancel shipment in Shiprocket", error: cancelData });
      }
    }

    if (order.payment_status === "Paid" && order.razorpay_payment_id) {
      const refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from("rzp_live_VRU7ggfYLI7DWV:giunOIOED3FhjWxW2dZ2peNe").toString("base64")}`,
        },
        body: JSON.stringify({ amount: order.total_price * 100, speed: "optimum" }),
      });

      const refundData = await refundResponse.json();
      if (!refundResponse.ok || !refundData.id) {
        return res.status(500).json({ success: false, message: "Refund failed", error: refundData });
      }

      order.refund_status = "Initiated";
    } else {
      order.refund_status = "Not Required";
    }

    // If promo code was applied, consider decrementing usage
    if (order.promoCode) {
      await PromoCode.findOneAndUpdate(
        { code: order.promoCode, isActive: true },
        { $inc: { currentUses: -1 } }
      );
    }

    order.order_status = "Cancelled";
    order.shipping_status = "Cancelled";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Create Return Order
exports.createReturnOrder = async (req, res) => {
  console.log("=== Starting createReturnOrder ===");
  try {
    console.log("Raw Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    const { orderId, reason } = req.body;
    const userId = req.user._id;
    const images = req.files;

    console.log("Parsed Request Body:", { orderId, reason });
    console.log("User ID:", userId);
    console.log("Uploaded Images:", images ? images.length : 0);

    if (!orderId || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: orderId and reason are required" 
      });
    }

    if (images && images.length > 3) {
      return res.status(400).json({ success: false, message: "Maximum 3 images allowed" });
    }

    const order = await Order.findById(orderId)
      .populate("items", "name price sku dimensions")
      .populate("item_quantities.item_id", "name price sku dimensions");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to return this order" });
    }

    if (order.shipping_status !== "Delivered") {
      return res.status(400).json({ success: false, message: "Order must be delivered to initiate a return" });
    }

    const deliveredDate = order.created_at;
    const currentDate = new Date();
    const daysSinceDelivery = (currentDate - new Date(deliveredDate)) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 30) {
      return res.status(400).json({ success: false, message: "Return period expired (30 days after delivery)" });
    }

    const token = await getShiprocketToken();
    console.log("Shiprocket Token:", token);
    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to authenticate with Shiprocket" });
    }

    let imageUrls = [];
    if (images && images.length > 0) {
      imageUrls = images.map(file => {
        console.log(`Processing image: ${file.originalname}`);
        return `https://example.com/uploads/${file.originalname}`;
      });
      console.log("Uploaded Image URLs:", imageUrls);
    }

    const returnDimensions = order.item_quantities.reduce((acc, qty) => {
      const detail = order.items.find(i => i._id.toString() === qty.item_id.toString())?.dimensions || { length: 10, breadth: 10, height: 10, weight: 0.5 };
      return {
        length: Math.max(acc.length || 0, (detail.length || 10) * qty.quantity),
        breadth: Math.max(acc.breadth || 0, (detail.breadth || 10) * qty.quantity),
        height: Math.max(acc.height || 0, (detail.height || 10) * qty.quantity),
        weight: (acc.weight || 0) + ((detail.weight || 0.5) * qty.quantity),
      };
    }, {});

    const returnPayload = {
      order_id: `R_${orderId}_${Date.now()}`,
      order_date: new Date().toISOString().split("T")[0],
      channel_id: process.env.SHIPROCKET_CHANNEL_ID || "6355414",
      pickup_customer_name: order.address.firstName,
      pickup_last_name: order.address.lastName || "",
      pickup_address: order.address.address,
      pickup_address_2: "",
      pickup_city: order.address.city,
      pickup_state: order.address.state,
      pickup_country: order.address.country || "India",
      pickup_pincode: order.address.pinCode,
      pickup_email: order.user?.email || "customer@example.com",
      pickup_phone: order.address.phoneNumber.replace(/\D/g, ""),
      pickup_isd_code: "91",
      shipping_customer_name: order.shipped_by.shipper_company_name || "Seller",
      shipping_last_name: "",
      shipping_address: order.shipped_by.shipper_address_1 || "Default Address",
      shipping_address_2: order.shipped_by.shipper_address_2 || "",
      shipping_city: order.shipped_by.shipper_city || "Default City",
      shipping_country: order.shipped_by.shipper_country || "India",
      shipping_pincode: order.shipped_by.shipper_postcode || "110001",
      shipping_state: order.shipped_by.shipper_state || "Default State",
      shipping_email: order.shipped_by.shipper_email || "seller@example.com",
      shipping_phone: order.shipped_by.shipper_phone || "9999999999",
      shipping_isd_code: "91",
      order_items: order.item_quantities.map((qty) => {
        const item = order.items.find(i => i._id.toString() === qty.item_id.toString());
        return {
          name: item?.name || "Unknown Item",
          sku: item?.sku || "UNKNOWN_SKU",
          units: qty.quantity,
          selling_price: item?.price || 0,
          discount: 0,
          hsn: item?.hsn || "1733808730720",
        };
      }),
      payment_method: "Prepaid",
      total_discount: order.promoDiscount || 0,
      sub_total: order.total_price,
      length: returnDimensions.length || 10,
      breadth: returnDimensions.breadth || 10,
      height: returnDimensions.height || 10,
      weight: returnDimensions.weight || 0.5,
      return_reason: reason || "Item defective or doesn't work",
    };

    console.log("Return Payload:", JSON.stringify(returnPayload, null, 2));

    const returnResponse = await fetch(`${SHIPROCKET_API_BASE}/orders/create/return`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(returnPayload),
    });

    const returnData = await returnResponse.json();
    console.log("Full Return Response:", JSON.stringify(returnData, null, 2));

    if (!returnResponse.ok || !returnData.order_id) {
      return res.status(500).json({
        success: false,
        message: "Failed to create return order",
        error: returnData.message || returnData,
      });
    }

    let returnAwbResult;
    const returnShipmentId = returnData.shipment_id;
    if (returnShipmentId) {
      returnAwbResult = await generateAWBWithCourier(returnShipmentId, token);
      if (!returnAwbResult.success) {
        console.error("Failed to assign return AWB:", returnAwbResult);
      }
    }

    let refundData;
    if (order.payment_status === "Paid" && order.razorpay_payment_id) {
      const refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${razorpay.key_id}:${razorpay.key_secret}`).toString("base64")}`,
        },
        body: JSON.stringify({ amount: order.total_price * 100, speed: "optimum" }),
      });

      refundData = await refundResponse.json();
      if (!refundResponse.ok || !refundData.id) {
        return res.status(500).json({ success: false, message: "Refund initiation failed", error: refundData });
      }
    }

    // If promo code was applied, decrement usage
    if (order.promoCode) {
      await PromoCode.findOneAndUpdate(
        { code: order.promoCode, isActive: true },
        { $inc: { currentUses: -1 } }
      );
    }

    order.refund = {
      requestDate: new Date(),
      status: refundData ? "Initiated" : "Pending",
      rmaNumber: returnPayload.order_id,
      amount: order.total_price,
      reason: reason || "Not specified",
      returnAwbCode: returnAwbResult?.success ? returnAwbResult.awbData.awb_code : returnData.awb_code || "",
      returnTrackingUrl: returnAwbResult?.success
        ? `https://shiprocket.co/tracking/${returnAwbResult.awbData.awb_code}`
        : returnData.awb_code
        ? `https://shiprocket.co/tracking/${returnData.awb_code}`
        : "",
      returnLabelUrl: returnData.label_url || "",
      shiprocketReturnId: returnData.order_id,
      returnShipmentId: returnData.shipment_id || "",
      refundTransactionId: refundData?.id || null,
      refundStatus: refundData ? "Initiated" : null,
      notes: "Return initiated via Shiprocket Return API",
      images: imageUrls
    };

    await order.save();

    res.status(200).json({
      success: true,
      message: "Return order created successfully" + (refundData ? " and refund initiated" : ""),
      rmaNumber: order.refund.rmaNumber,
      returnLabelUrl: order.refund.returnLabelUrl,
      refund: order.refund,
    });
  } catch (error) {
    console.error("Error in createReturnOrder:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

// Create Exchange Order
exports.createExchangeOrder = async (req, res) => {
  console.log("=== Starting createExchangeOrder ===");
  try {
    console.log("Raw Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    const { orderId, newItemId, desiredSize, reason } = req.body;
    const userId = req.user._id;
    const images = req.files;

    console.log("Parsed Request Body:", { orderId, newItemId, desiredSize, reason });
    console.log("User ID:", userId);
    console.log("Uploaded Images:", images ? images.length : 0);

    if (!orderId || !newItemId || !desiredSize || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: orderId, newItemId, desiredSize, and reason are required" 
      });
    }

    if (images && images.length > 3) {
      return res.status(400).json({ success: false, message: "Maximum 3 images allowed" });
    }

    const order = await Order.findById(orderId)
      .populate("items", "name price sku dimensions")
      .populate("item_quantities.item_id", "name price sku dimensions");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to exchange this order" });
    }

    if (order.shipping_status !== "Delivered") {
      return res.status(400).json({ success: false, message: "Order must be delivered to initiate an exchange" });
    }

    const deliveredDate = order.created_at;
    const currentDate = new Date();
    const daysSinceDelivery = (currentDate - new Date(deliveredDate)) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 30) {
      return res.status(400).json({ success: false, message: "Exchange period expired (30 days after delivery)" });
    }

    const token = await getShiprocketToken();
    console.log("Shiprocket Token:", token);
    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to authenticate with Shiprocket" });
    }

    let imageUrls = [];
    if (images && images.length > 0) {
      imageUrls = images.map(file => {
        console.log(`Processing image: ${file.originalname}`);
        return `https://example.com/uploads/${file.originalname}`;
      });
      console.log("Uploaded Image URLs:", imageUrls);
    }

    const returnDimensions = order.item_quantities.reduce((acc, qty) => {
      const detail = order.items.find(i => i._id.toString() === qty.item_id.toString())?.dimensions || { length: 10, breadth: 10, height: 10, weight: 0.5 };
      return {
        length: Math.max(acc.length || 0, (detail.length || 10) * qty.quantity),
        breadth: Math.max(acc.breadth || 0, (detail.breadth || 10) * qty.quantity),
        height: Math.max(acc.height || 0, (detail.height || 10) * qty.quantity),
        weight: (acc.weight || 0) + ((detail.weight || 0.5) * qty.quantity),
      };
    }, {});

    const exchangeDimensions = order.item_quantities.reduce((acc, qty) => {
      const detail = order.items.find(i => i._id.toString() === qty.item_id.toString())?.dimensions || { length: 11, breadth: 11, height: 11, weight: 0.5 };
      return {
        length: Math.max(acc.length || 0, (detail.length || 11) * qty.quantity),
        breadth: Math.max(acc.breadth || 0, (detail.breadth || 11) * qty.quantity),
        height: Math.max(acc.height || 0, (detail.height || 11) * qty.quantity),
        weight: (acc.weight || 0) + ((detail.weight || 0.5) * qty.quantity),
      };
    }, {});

    const exchangePayload = {
      exchange_order_id: `EX_${orderId}_${Date.now()}`,
      seller_pickup_location_id: process.env.SELLER_PICKUP_LOCATION_ID || "7256830",
      seller_shipping_location_id: process.env.SELLER_SHIPPING_LOCATION_ID || "7256830",
      return_order_id: `R_${orderId}_${Date.now()}`,
      order_date: new Date().toISOString().split("T")[0],
      payment_method: "prepaid",
      channel_id: process.env.SHIPROCKET_CHANNEL_ID || "6355414",
      buyer_shipping_first_name: order.address.firstName,
      buyer_shipping_address: order.address.address,
      buyer_shipping_city: order.address.city,
      buyer_shipping_state: order.address.state,
      buyer_shipping_country: order.address.country || "India",
      buyer_shipping_pincode: order.address.pinCode,
      buyer_shipping_phone: order.address.phoneNumber.replace(/\D/g, ""),
      buyer_shipping_email: order.user?.email || "customer@example.com",
      buyer_pickup_first_name: order.address.firstName,
      buyer_pickup_address: order.address.address,
      buyer_pickup_city: order.address.city,
      buyer_pickup_state: order.address.state,
      buyer_pickup_country: order.address.country || "India",
      buyer_pickup_pincode: order.address.pinCode,
      buyer_pickup_phone: order.address.phoneNumber.replace(/\D/g, ""),
      order_items: order.item_quantities.map((qty) => {
        const item = order.items.find(i => i._id.toString() === qty.item_id.toString());
        return {
          name: item?.name || "Unknown Item",
          selling_price: item?.price || 0,
          units: qty.quantity,
          hsn: item?.hsn || "1733808730720",
          sku: item?.sku || newItemId,
          exchange_item_name: item?.name || "Unknown Item",
          exchange_item_sku: newItemId,
        };
      }),
      sub_total: order.total_price,
      total_discount: order.promoDiscount || 0,
      return_length: returnDimensions.length || 10,
      return_breadth: returnDimensions.breadth || 10,
      return_height: returnDimensions.height || 10,
      return_weight: returnDimensions.weight || 0.5,
      exchange_length: exchangeDimensions.length || 11,
      exchange_breadth: exchangeDimensions.breadth || 11,
      exchange_height: exchangeDimensions.height || 11,
      exchange_weight: exchangeDimensions.weight || 0.5,
      return_reason: 29
    };

    console.log("Exchange Payload:", JSON.stringify(exchangePayload, null, 2));

    const exchangeResponse = await fetch(`${SHIPROCKET_API_BASE}/orders/create/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(exchangePayload),
    });

    const exchangeData = await exchangeResponse.json();
    console.log("Full Exchange Response:", JSON.stringify(exchangeData, null, 2));

    if (!exchangeResponse.ok || !exchangeData.success) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create exchange order", 
        error: exchangeData.message || exchangeData 
      });
    }

    let returnAwbResult;
    const returnShipmentId = exchangeData.data?.return_orders?.shipment_id;
    if (returnShipmentId) {
      returnAwbResult = await generateAWBWithCourier(returnShipmentId, token);
      if (!returnAwbResult.success) {
        console.error("Failed to assign return AWB:", returnAwbResult);
      }
    } else {
      console.warn("Return shipment ID not found in response");
    }

    let forwardAwbResult;
    const forwardShipmentId = exchangeData.data?.forward_orders?.shipment_id;
    if (forwardShipmentId) {
      forwardAwbResult = await generateAWBWithCourier(forwardShipmentId, token);
      if (!forwardAwbResult.success) {
        console.error("Failed to assign forward AWB:", forwardAwbResult);
      }
    } else {
      console.warn("Forward shipment ID not found in response");
    }

    // If promo code was applied, decrement usage
    if (order.promoCode) {
      await PromoCode.findOneAndUpdate(
        { code: order.promoCode, isActive: true },
        { $inc: { currentUses: -1 } }
      );
    }

    order.exchange = {
      requestDate: new Date(),
      status: "Pending",
      rmaNumber: exchangePayload.return_order_id,
      newItemId,
      desiredSize,
      reason: reason || "Not specified",
      returnAwbCode: returnAwbResult?.success ? returnAwbResult.awbData.awb_code : exchangeData.data?.return_orders?.awb_code || "",
      returnTrackingUrl: returnAwbResult?.success ? 
        `https://shiprocket.co/tracking/${returnAwbResult.awbData.awb_code}` : 
        exchangeData.data?.return_orders?.awb_code ? `https://shiprocket.co/tracking/${exchangeData.data.return_orders.awb_code}` : "",
      returnLabelUrl: exchangeData.data?.return_orders?.label_url || "",
      shiprocketReturnId: exchangeData.data?.return_orders?.order_id || exchangePayload.return_order_id,
      returnShipmentId: exchangeData.data?.return_orders?.shipment_id || "",
      forwardAwbCode: forwardAwbResult?.success ? forwardAwbResult.awbData.awb_code : exchangeData.data?.forward_orders?.awb_code || "",
      forwardTrackingUrl: forwardAwbResult?.success ? 
        `https://shiprocket.co/tracking/${forwardAwbResult.awbData.awb_code}` : 
        exchangeData.data?.forward_orders?.awb_code ? `https://shiprocket.co/tracking/${exchangeData.data.forward_orders.awb_code}` : "",
      shiprocketForwardOrderId: exchangeData.data?.forward_orders?.order_id || exchangePayload.exchange_order_id,
      forwardShipmentId: exchangeData.data?.forward_orders?.shipment_id || "",
      notes: "Exchange initiated via Shiprocket Exchange API",
      images: imageUrls
    };

    order.item_quantities.forEach(item => {
      item.desiredSize = desiredSize || item.desiredSize || "Not specified";
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: "Exchange order created successfully" + 
        (returnAwbResult?.success ? " with return AWB assigned" : "") + 
        (forwardAwbResult?.success ? " with forward AWB assigned" : ""),
      rmaNumber: order.exchange.rmaNumber,
      returnLabelUrl: order.exchange.returnLabelUrl,
      exchange: order.exchange,
      forwardAwbCode: order.exchange.forwardAwbCode,
      returnAwbCode: order.exchange.returnAwbCode,
    });
  } catch (error) {
    console.error("Error in createExchangeOrder:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

// Get Orders By User
exports.getOrdersByUser = async (req, res) => {
  console.log("Fetching user orders...");

  try {
    const userId = req.user._id;
    console.log("User ID:", userId);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({
      user: userId,
    });

    console.log("Total eligible orders:", totalOrders);

    const orders = await Order.find({
      user: userId,
    })
      .populate("user", "firstName lastName email phoneNumber")
      .populate("items", "name price imageUrl description")
      .populate("item_quantities.item_id", "name price image")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    console.log("Orders retrieved:", orders.length);
    console.log("Orders Data:", JSON.stringify(orders, null, 2));

    if (!orders.length) {
      console.log("No active orders found.");
      return res.status(404).json({ success: false, message: "No active orders found for this user" });
    }

    res.status(200).json({
      success: true,
      totalOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get All Orders Sorted
exports.getAllOrdersSorted = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "firstName lastName email phoneNumber")
      .populate("items", "name price image description")
      .populate("item_quantities.item_id", "name price image")
      .sort({ created_at: -1 });

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    res.status(200).json({
      success: true,
      totalOrders: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Error fetching sorted orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Authenticate Shiprocket
exports.authenticateShiprocket = async (req, res) => {
  try {
    const token = await getShiprocketToken();
    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to authenticate with Shiprocket" });
    }
    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Error authenticating Shiprocket:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Shiprocket Tracking
exports.getShiprocketTracking = async (req, res) => {
  try {
    const { awbCode } = req.params;
    const shiprocketToken = await getShiprocketToken();
    if (!shiprocketToken) {
      return res.status(500).json({ success: false, message: "Failed to authenticate with Shiprocket" });
    }

    const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${awbCode}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${shiprocketToken}`,
      },
    });

    const data = await response.json();
    if (!response.ok || !data.tracking_data) {
      return res.status(404).json({ success: false, message: "Tracking data not available" });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching Shiprocket tracking:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Delivered Orders By User
exports.getDeliveredOrdersByUser = async (req, res) => {
  console.log("Fetching delivered orders for user...");

  try {
    const userId = req.user._id;
    console.log("User ID:", userId);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalDeliveredOrders = await Order.countDocuments({
      user: userId,
      shipping_status: "Delivered",
    });

    console.log("Total delivered orders:", totalDeliveredOrders);

    const orders = await Order.find({
      user: userId,
      shipping_status: "Delivered",
    })
      .populate("user", "firstName lastName email phoneNumber")
      .populate("items", "name price imageUrl description")
      .populate("item_quantities.item_id", "name price image")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    console.log("Delivered Orders Retrieved:", orders.length);
    console.log("Orders Data:", JSON.stringify(orders, null, 2));

    if (!orders.length) {
      console.log("No delivered orders found.");
      return res.status(404).json({ success: false, message: "No delivered orders found for this user" });
    }

    res.status(200).json({
      success: true,
      totalDeliveredOrders,
      currentPage: page,
      totalPages: Math.ceil(totalDeliveredOrders / limit),
      orders,
    });
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Return Orders By User
exports.getReturnOrdersByUser = async (req, res) => {
  console.log("Fetching return orders for user...");

  try {
    const userId = req.user._id;
    console.log("User ID:", userId);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalReturnOrders = await Order.countDocuments({
      user: userId,
      "refund.requestDate": { $exists: true },
    });

    console.log("Total return orders:", totalReturnOrders);

    const returnOrders = await Order.find({
      user: userId,
      "refund.requestDate": { $exists: true },
    })
      .populate("user", "firstName lastName email phoneNumber")
      .populate("items", "name price imageUrl description")
      .populate("item_quantities.item_id", "name price image")
      .select("order_status shipping_status total_price refund created_at")
      .sort({ "refund.requestDate": -1 })
      .skip(skip)
      .limit(limit);

    console.log("Return Orders Retrieved:", returnOrders.length);
    console.log("Return Orders Data:", JSON.stringify(returnOrders, null, 2));

    if (!returnOrders.length) {
      console.log("No return orders found.");
      return res.status(404).json({
        success: false,
        message: "No return orders found for this user",
      });
    }

    res.status(200).json({
      success: true,
      totalReturnOrders,
      currentPage: page,
      totalPages: Math.ceil(totalReturnOrders / limit),
      returnOrders,
    });
  } catch (error) {
    console.error("Error fetching return orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get Exchange Orders By User
exports.getExchangeOrdersByUser = async (req, res) => {
  console.log("Fetching exchange orders for user...");

  try {
    const userId = req.user._id;
    console.log("User ID:", userId);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalExchangeOrders = await Order.countDocuments({
      user: userId,
      "exchange.requestDate": { $exists: true },
    });

    console.log("Total exchange orders:", totalExchangeOrders);

    const exchangeOrders = await Order.find({
      user: userId,
      "exchange.requestDate": { $exists: true },
    })
      .populate("user", "firstName lastName email phoneNumber")
      .populate("items", "name price imageUrl description")
      .populate("item_quantities.item_id", "name price image")
      .select("order_status shipping_status total_price exchange created_at")
      .sort({ "exchange.requestDate": -1 })
      .skip(skip)
      .limit(limit);

    console.log("Exchange Orders Retrieved:", exchangeOrders.length);
    console.log("Exchange Orders Data:", JSON.stringify(exchangeOrders, null, 2));

    if (!exchangeOrders.length) {
      console.log("No exchange orders found.");
      return res.status(404).json({
        success: false,
        message: "No exchange orders found for this user",
      });
    }

    res.status(200).json({
      success: true,
      totalExchangeOrders,
      currentPage: page,
      totalPages: Math.ceil(totalExchangeOrders / limit),
      exchangeOrders,
    });
  } catch (error) {
    console.error("Error fetching exchange orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get Order Status Counts
exports.getOrderStatusCounts = async (req, res) => {
  try {
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrdered: {
            $sum: {
              $cond: [{ $ne: ["$order_status", "Cancelled"] }, 1, 0]
            }
          },
          totalDelivered: {
            $sum: {
              $cond: [{ $eq: ["$shipping_status", "Delivered"] }, 1, 0]
            }
          },
          totalCancelled: {
            $sum: {
              $cond: [{ $eq: ["$order_status", "Cancelled"] }, 1, 0]
            }
          },
          totalRefunded: {
            $sum: {
              $cond: [
                { $in: ["$refund.status", ["Processed", "Initiated"]] },
                1,
                0
              ]
            }
          },
          totalExchanged: {
            $sum: {
              $cond: [
                { $in: ["$exchange.status", ["Shipped", "Shiprocket_Shipped"]] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalOrdered: 1,
          totalDelivered: 1,
          totalCancelled: 1,
          totalRefunded: 1,
          totalExchanged: 1
        }
      }
    ]);

    const stats = orderStats.length > 0 ? orderStats[0] : {
      totalOrdered: 0,
      totalDelivered: 0,
      totalCancelled: 0,
      totalRefunded: 0,
      totalExchanged: 0
    };

    console.log("Order Status Counts:", stats);

    res.status(200).json({
      success: true,
      message: "Order status counts retrieved successfully",
      data: stats
    });
  } catch (error) {
    console.error("Error fetching order status counts:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};