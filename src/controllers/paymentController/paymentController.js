const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../../models/Order");
const { uploadMultipart, deleteFileFromS3 } = require("../../utils/S3");
const mongoose = require("mongoose");
const Item = require("../../models/Item");
const ItemDetails = require("../../models/ItemDetails");

const razorpay = new Razorpay({
  key_id: "rzp_live_VRU7ggfYLI7DWV",
  key_secret: "giunOIOED3FhjWxW2dZ2peNe",
});

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_EMAIL = "support@yoraa.in";
const SHIPROCKET_PASSWORD = "R@2727thik";

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, cart, staticAddress } = req.body;
    const userId = req.user._id;

    console.log("amount:", amount);
    console.log("cart:", cart);
    console.log("address:", staticAddress);
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

    const options = {
      amount: amount * 100, // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    // Create Razorpay Order
    const order = await razorpay.orders.create(options);

    // Prepare item_quantities with SKUs
    const itemQuantities = cart.map(cartItem => ({
      item_id: cartItem.itemId,
      sku: cartItem.sku,
      quantity: cartItem.quantity,
    }));

    // Save Order in Database
    const newOrder = new Order({
      user: userId,
      items: itemIds,
      total_price: amount,
      payment_status: "Pending",
      razorpay_order_id: order.id,
      address: staticAddress,
      item_quantities: itemQuantities,
    });

    await newOrder.save();

    res.json(order);
    console.log("orders", order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Error creating Razorpay order" });
  }
};

// Get Shiprocket Token
async function getShiprocketToken() {
  try {
    const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }),
    });
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Shiprocket Auth Error:", error);
    return null;
  }
}

// Generate AWB with Courier
async function generateAWBWithCourier(shipmentId, token, preferredCourier = null) {
  try {
    // Generate AWB
    const awbResponse = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shipment_id: shipmentId,
      }),
    });

    const awbData = await awbResponse.json();
    console.log("awbData1111111111111", awbData);

    // Check if AWB assignment was successful
    if (awbData.awb_assign_status !== 1) {
      console.error("Failed to generate AWB:", awbData);
      return { success: false, message: "AWB generation failed", error: awbData };
    }

    return {
      success: true,
      message: "AWB generated successfully",
      awbData: awbData.response.data, // Return the nested data object
    };
  } catch (error) {
    console.error("Error generating AWB:", error);
    return { success: false, message: "Error generating AWB", error };
  }
}

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

    // Track stock updates for Items to avoid multiple queries
    const itemStockUpdates = new Map(); // Map to aggregate quantities per item

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
          sizeEntry.stock -= quantity; // Decrease stock in ItemDetails
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
      item.stock -= quantity; // Decrease stock in Item
      await item.save();
    }

    // Get Shiprocket API Token
    const token = await getShiprocketToken();
    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to authenticate Shiprocket" });
    }

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
        // Validate awbData structure
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
        // Proceed without AWB but log the failure
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