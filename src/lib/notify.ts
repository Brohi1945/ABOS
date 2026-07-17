// ============================================================
//  Notification helpers - NOW SUPPORTS BOTH SMS (Twilio) AND 
//  WhatsApp (Meta Cloud API) - Smart fallback
// ============================================================

interface OrderItem {
  name: string;
  qty: number;
}

interface Order {
  id: string;
  customer: string;
  total: number;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  threshold: number;
  stock?: number;
}

// ---- SMS via Twilio (/api/notify) ----
async function sendSMS(message: string, to?: string): Promise<void> {
  try {
    const response = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(to ? { message, to } : { message }),
    });
    
    if (!response.ok) {
      console.error("SMS send failed:", await response.text());
    }
  } catch (err: any) {
    console.error("sendSMS failed:", err.message);
  }
}

// ---- WhatsApp via Meta Cloud API (direct) ----
async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  try {
    const response = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    
    if (!response.ok) {
      console.error("WhatsApp send failed:", await response.text());
    }
  } catch (err: any) {
    console.error("sendWhatsAppMessage failed:", err.message);
  }
}

// ---- Smart sender: tries WhatsApp first, falls back to SMS ----
async function sendNotification(
  message: string, 
  to?: string, 
  preferWhatsApp: boolean = false
): Promise<void> {
  if (!to) {
    // Admin notification (no phone number) - SMS only
    await sendSMS(message);
    return;
  }

  // Format phone number for WhatsApp (remove spaces, dashes, add country code if needed)
  const cleanPhone = to.replace(/[\s\-()]/g, '');
  const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
  
  // Try WhatsApp first if preferred or if it's a Pakistani number (likely WhatsApp user)
  const shouldUseWhatsApp = preferWhatsApp || cleanPhone.startsWith('92') || cleanPhone.startsWith('03');
  
  if (shouldUseWhatsApp) {
    await sendWhatsAppMessage(whatsappPhone, message);
  } else {
    await sendSMS(message, to);
  }
}

// ---- Public notification functions ----

export function notifyNewOrder(order: Order): void {
  const itemsText = (order.items || [])
    .map((it) => `${it.qty}x ${it.name}`)
    .join(", ");
  
  sendNotification(
    `🛒 Naya order ${order.id}\nCustomer: ${order.customer}\nItems: ${itemsText}\nTotal: Rs ${order.total}`,
    undefined, // Admin SMS only
    false
  );
}

export function notifyLowStock(product: Product, newStock: number): void {
  sendNotification(
    `⚠️ Low stock alert: ${product.name} sirf ${newStock} units bache hain (threshold: ${product.threshold}).`,
    undefined, // Admin SMS only
    false
  );
}

export function notifyWaitlistAvailable(
  product: Product, 
  phone: string, 
  customerName: string
): void {
  const message = `🎉 ${customerName}, khushkhabri! "${product.name}" ab dobara available hai aur aapke liye 48 ghanton tak reserve hai. Order confirm karne ke liye jaldi WhatsApp/Store par order place karein, warna yeh kisi aur ko offer ho jayega.`;
  
  // WhatsApp ko priority do (customer hai)
  sendNotification(message, phone, true);
}

export function notifyWaitlistExpiring(
  product: Product,
  phone: string,
  customerName: string,
  hoursLeft: number
): void {
  const message = `⏰ ${customerName}, "${product.name}" sirf ${hoursLeft} ghante ke liye reserve hai. Jaldi order karein warna yeh kisi aur ko offer ho jayega!`;
  
  sendNotification(message, phone, true);
}
