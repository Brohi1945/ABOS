// ============================================================
//  SMS/WhatsApp notification helpers (Twilio, via /api/notify)
//  These are "fire and forget" — they never throw, so a notification
//  failure (or Twilio not being configured yet) never breaks the order
//  or inventory flow that triggered it.
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
  name: string;
  threshold: number;
}

async function sendNotification(message: string, to?: string): Promise<void> {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(to ? { message, to } : { message }),
    });
  } catch (err: any) {
    console.error("sendNotification failed:", err.message);
  }
}

export function notifyNewOrder(order: Order): void {
  const itemsText = (order.items || []).map((it) => `${it.qty}x ${it.name}`).join(", ");
  sendNotification(
    `Naya order ${order.id}\nCustomer: ${order.customer}\nItems: ${itemsText}\nTotal: Rs ${order.total}`
  );
}

export function notifyLowStock(product: Product, newStock: number): void {
  sendNotification(
    `Low stock alert: ${product.name} sirf ${newStock} units bache hain (threshold: ${product.threshold}).`
  );
}

// Waitlist customer ko unke phone number pe bheja jata hai jab unka
// reserve-kiya hua product available ho jaye. Isi /api/notify route se
// jaata hai jo abhi Twilio SMS use kar raha hai — jab WhatsApp API lagegi,
// sirf api/notify.js ke andar ka provider badalna hoga, yeh function nahi.
export function notifyWaitlistAvailable(product: Product, phone: string, customerName: string): void {
  sendNotification(
    `${customerName}, khushkhabri! "${product.name}" ab dobara available hai aur aapke liye 48 ghanton tak reserve hai. Order confirm karne ke liye jaldi order place karein, warna yeh kisi aur ko offer ho jayega.`,
    phone
  );
}
