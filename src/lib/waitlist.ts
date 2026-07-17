// ============================================================
//  Waitlist Business Logic - Complete System
//  FIFO ordering, 48-hour reservation, automatic notifications
// ============================================================

import {
  fetchWaitlist,
  fetchAllWaitlist,
  fetchExpiredReservations,
  insertWaitlistEntry,
  updateWaitlistRow,
  updateProductRow,
} from "../supabaseClient";
import { notifyWaitlistAvailable } from "./notify";

const RESERVE_HOURS = 48;

export interface Product {
  id: string;
  name: string;
  stock: number;
  reserved_stock?: number;
  threshold: number;
}

export interface WaitlistEntry {
  id: string;
  product_id: string;
  customer_name: string;
  phone: string;
  qty: number;
  status: 'waiting' | 'notified' | 'converted' | 'expired';
  channel?: string;
  joined_at?: string;
  notified_at?: string;
  reserve_expires_at?: string;
  order_id?: string;
}

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Calculate available stock (total - reserved)
 */
export function availableStock(product: Product): number {
  return Math.max(0, (product.stock || 0) - (product.reserved_stock || 0));
}

/**
 * Check if product is out of stock
 */
export function isOutOfStock(product: Product): boolean {
  return availableStock(product) <= 0;
}

/**
 * Check if product is low stock (below threshold)
 */
export function isLowStock(product: Product): boolean {
  return product.stock <= product.threshold;
}

// ============================================================
//  CUSTOMER FACING FUNCTIONS
// ============================================================

/**
 * Add customer to waitlist for a product
 * Returns position in queue or null if failed
 */
export async function joinWaitlist({
  product,
  customerName,
  phone,
  qty = 1,
  channel = 'Website',
}: {
  product: Product;
  customerName: string;
  phone: string;
  qty?: number;
  channel?: string;
}): Promise<{ position: number } | null> {
  // Check if product exists
  if (!product || !product.id) {
    console.error("joinWaitlist: Invalid product");
    return null;
  }

  // Check if customer is already on waitlist for this product
  const existing = await fetchWaitlist(product.id);
  const alreadyWaiting = existing.find(
    (w: any) => w.phone === phone && w.status === 'waiting'
  );
  
  if (alreadyWaiting) {
    console.log(`Customer ${phone} already on waitlist for ${product.id}`);
    return { position: existing.filter((w: any) => w.status === 'waiting').length };
  }

  // Calculate position
  const position = existing.filter((w: any) => w.status === 'waiting').length + 1;

  // Insert entry
  const entry = await insertWaitlistEntry({
    product_id: product.id,
    customer_name: customerName,
    phone,
    qty: Math.max(1, qty),
    status: 'waiting',
    channel: channel || 'Website',
    joined_at: new Date().toISOString(),
  });

  if (!entry) {
    console.error("joinWaitlist: Failed to insert entry");
    return null;
  }

  console.log(`✅ ${customerName} joined waitlist for ${product.name} (position: ${position})`);
  return { position };
}

// ============================================================
//  ADMIN / SYSTEM FUNCTIONS
// ============================================================

/**
 * Check if stock is available and notify waitlist customers (FIFO)
 * Called when product is restocked
 */
export async function checkAndNotifyWaitlist(
  product: Product,
  onProductUpdate?: (id: string, fields: Partial<Product>) => void
): Promise<void> {
  const spare = availableStock(product);
  
  // No stock available
  if (spare <= 0) {
    console.log(`📦 ${product.name}: No spare stock (${spare} units available)`);
    return;
  }

  // Get waiting customers (FIFO order)
  const waiting = (await fetchWaitlist(product.id))
    .filter((w: any) => w.status === 'waiting')
    .sort((a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  if (!waiting.length) {
    console.log(`📦 ${product.name}: No customers waiting`);
    return;
  }

  console.log(`📦 ${product.name}: ${spare} units available, ${waiting.length} customers waiting`);

  let remaining = spare;
  let reservedNow = 0;
  let notifiedCount = 0;

  // Notify customers in FIFO order
  for (const entry of waiting) {
    if (remaining <= 0) break;
    
    const offerQty = Math.min(entry.qty || 1, remaining);
    remaining -= offerQty;
    reservedNow += offerQty;
    notifiedCount++;

    // Calculate expiry time (48 hours from now)
    const reserveExpiresAt = new Date(Date.now() + RESERVE_HOURS * 3600 * 1000).toISOString();

    // Update waitlist entry
    await updateWaitlistRow(entry.id, {
      status: 'notified',
      notified_at: new Date().toISOString(),
      reserve_expires_at: reserveExpiresAt,
    });

    // Send WhatsApp/SMS notification
    try {
      await notifyWaitlistAvailable(product, entry.phone, entry.customer_name);
      console.log(`📱 Notified ${entry.customer_name} (${entry.phone}) for ${product.name}`);
    } catch (error) {
      console.error(`Failed to notify ${entry.customer_name}:`, error);
    }
  }

  // Update reserved stock
  if (reservedNow > 0) {
    const newReserved = (product.reserved_stock || 0) + reservedNow;
    await updateProductRow(product.id, { reserved_stock: newReserved });
    onProductUpdate?.(product.id, { reserved_stock: newReserved });
    
    console.log(`✅ ${notifiedCount} customers notified, ${reservedNow} units reserved for ${product.name}`);
  }
}

/**
 * Expire stale reservations (older than 48 hours)
 * Called periodically (e.g., on app load)
 */
export async function expireStaleReservations(
  products: Product[],
  onProductUpdate?: (id: string, fields: Partial<Product>) => void
): Promise<void> {
  const stale = await fetchExpiredReservations();
  
  if (!stale.length) {
    console.log('✅ No stale reservations to expire');
    return;
  }

  console.log(`⏰ Expiring ${stale.length} stale reservations`);

  const releasedByProduct: Record<string, number> = {};

  // Mark entries as expired
  for (const entry of stale) {
    await updateWaitlistRow(entry.id, { status: 'expired' });
    releasedByProduct[entry.product_id] = (releasedByProduct[entry.product_id] || 0) + (entry.qty || 1);
  }

  // Release reserved stock
  for (const productId of Object.keys(releasedByProduct)) {
    const product = products.find((p) => p.id === productId);
    if (!product) continue;

    const releasedQty = releasedByProduct[productId];
    const newReserved = Math.max(0, (product.reserved_stock || 0) - releasedQty);
    
    await updateProductRow(productId, { reserved_stock: newReserved });
    onProductUpdate?.(productId, { reserved_stock: newReserved });
    
    console.log(`📦 Released ${releasedQty} units for ${product.name}`);
  }
}

/**
 * Convert waitlist notification to actual order
 * Called when customer places order after notification
 */
export async function convertWaitlistIfMatched(
  product: Product,
  phone: string,
  orderId: string,
  onProductUpdate?: (id: string, fields: Partial<Product>) => void
): Promise<boolean> {
  if (!phone) return false;

  // Find matching notified entry
  const entries = await fetchWaitlist(product.id);
  const match = entries.find(
    (w: any) => w.status === 'notified' && w.phone === phone
  );

  if (!match) {
    console.log(`No matching waitlist entry for ${phone} - ${product.name}`);
    return false;
  }

  // Mark as converted
  await updateWaitlistRow(match.id, {
    status: 'converted',
    order_id: orderId,
    converted_at: new Date().toISOString(),
  });

  // Release reserved stock
  const qty = match.qty || 1;
  const newReserved = Math.max(0, (product.reserved_stock || 0) - qty);
  await updateProductRow(product.id, { reserved_stock: newReserved });
  onProductUpdate?.(product.id, { reserved_stock: newReserved });

  console.log(`✅ Waitlist entry ${match.id} converted to order ${orderId}`);
  return true;
}

// ============================================================
//  EXPORTED TRIGGER FUNCTION FOR ADMIN
// ============================================================

/**
 * Manually trigger waitlist notifications for a product
 * Useful for admin-initiated restocks via WhatsApp
 */
export async function triggerWaitlistNotifications(
  product: Product,
  onProductUpdate?: (id: string, fields: Partial<Product>) => void
): Promise<void> {
  console.log(`🔔 Manually triggering waitlist notifications for ${product.name}`);
  await checkAndNotifyWaitlist(product, onProductUpdate);
}

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

/**
 * Get waitlist status for a customer
 */
export async function getCustomerWaitlistStatus(
  phone: string
): Promise<{ product: string; status: string; position?: number }[]> {
  const allEntries = await fetchAllWaitlist();
  const customerEntries = allEntries.filter((e: any) => e.phone === phone);
  
  return customerEntries.map((e: any) => ({
    product: e.product_id,
    status: e.status,
    position: e.status === 'waiting' 
      ? allEntries.filter((w: any) => w.product_id === e.product_id && w.status === 'waiting' && new Date(w.joined_at) <= new Date(e.joined_at)).length
      : undefined,
  }));
}

/**
 * Get waitlist count for a product
 */
export async function getWaitlistCount(productId: string): Promise<number> {
  const entries = await fetchWaitlist(productId);
  return entries.filter((e: any) => e.status === 'waiting').length;
}

/**
 * Get all customers waiting for a product
 */
export async function getWaitingCustomers(productId: string): Promise<WaitlistEntry[]> {
  const entries = await fetchWaitlist(productId);
  return entries
    .filter((e: any) => e.status === 'waiting')
    .sort((a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
}

// ============================================================
//  COMPATIBILITY EXPORTS (for existing code)
// ============================================================

// Export the same functions with different names for backward compatibility
export { checkAndNotifyWaitlist as processWaitlist };
