import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, Topbar } from "../components/layout";
import { GlobalSearch } from "../components/GlobalSearch";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { bodyFont } from "../theme";
import { money, genId, Product, Order, Customer } from "../lib/utils";
import { seedCampaigns } from "../lib/seedData";
import { notifyLowStock } from "../lib/notify";
import { checkAndNotifyWaitlist } from "../lib/waitlist";
import { NAV_ITEMS } from "../config/app.config";
import {
  insertProduct,
  updateProductRow,
  deleteProductRow,
  insertOrder,
  updateOrderStatusRow,
} from "../supabaseClient";
import { fadeSlideUp } from "../animations/variants";
import DashboardView from "../views/DashboardView";
import OrdersView from "../views/OrdersView";
import InventoryView from "../views/InventoryView";
import CustomersView from "../views/CustomersView";
import WaitlistView from "../views/WaitlistView";
import POSView from "../views/POSView";
import AccountingView from "../views/AccountingView";
import BusinessIntelligenceView from "../views/BusinessIntelligenceView";
import MarketingView from "../views/MarketingView";
import AssistantView from "../views/AssistantView";

interface AdminAppProps {
  section: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onGoStore: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export default function AdminApp({
  section,
  onSectionChange,
  onLogout,
  onGoStore,
  products,
  setProducts,
  orders,
  setOrders,
  customers,
  setCustomers,
}: AdminAppProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [campaigns, setCampaigns] = useState(seedCampaigns());
  const [searchOpen, setSearchOpen] = useState(false);
  const [openAddSignal, setOpenAddSignal] = useState(0);

  // AI Assistant is no longer a routed page (it used to live inside
  // renderView()'s switch, which meant switching sections unmounted it —
  // that's what was cutting off in-progress voice replies mid-sentence).
  // It's now a persistent overlay mounted once here, toggled between
  // three states: "closed" (never opened yet), "minimized" (small
  // floating bubble that keeps listening/speaking across every page),
  // and "full" (the complete chat panel on top of everything).
  const [assistantMode, setAssistantMode] = useState("closed");

  // Sidebar's "AI Assistant" item no longer changes `section` — it just
  // opens the overlay full-screen. Every other item behaves as before,
  // except that if the assistant was open full-screen, picking a
  // different section now minimizes it instead of closing it outright.
  const handleSidebarSelect = (key) => {
    if (key === "assistant") {
      setAssistantMode("full");
      return;
    }
    if (assistantMode === "full") setAssistantMode("minimized");
    onSectionChange(key);
  };

  const lowStock = products.filter((p) => p.stock <= p.threshold);
  const pendingOrders = orders.filter((o) => o.status === "pending");

  const notifications = [
    ...pendingOrders.slice(0, 3).map((o) => ({
      title: `New order ${o.id}`,
      note: `${o.customer} · ${money(o.total)}`,
    })),
    ...lowStock.slice(0, 2).map((p) => ({
      title: `${p.name} is low on stock`,
      note: `${p.stock} units left`,
    })),
  ];

  const handleUpdateStatus = (id: string, status: Order["status"]) => {
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
    updateOrderStatusRow(id, status);
  };

  const handleAddProduct = (form) => {
    const newProduct = {
      id: genId("P"),
      barcode: form.barcode || genId("BC"),
      name: form.name,
      category: form.category,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      threshold: Number(form.threshold) || 10,
      color: "bg-indigo-100 text-indigo-700",
      specs: form.specs || "",
    };
    setProducts((ps) => [newProduct, ...ps]);
    insertProduct(newProduct);
  };

  const handleEditProduct = (id: string, form: any) => {
    const fields = {
      ...form,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      threshold: Number(form.threshold) || 10,
    };
    const previous = products.find((p) => p.id === id);
    const updatedProduct = { ...previous, ...fields };
    setProducts((ps) => ps.map((p) => (p.id === id ? updatedProduct : p)));
    updateProductRow(id, fields);

    // Stock badha (restock) to waitlist par bethe customers ko FIFO order
    // mein notify + reserve karo.
    if (previous && updatedProduct.stock > previous.stock) {
      checkAndNotifyWaitlist(updatedProduct, updateProductField);
    }
  };

  const updateProductField = (id: string, fields: Partial<Product>) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    deleteProductRow(id);
  };

  const handleAddCustomer = (form: any) => {
    setCustomers((cs) => [
      {
        id: genId("C"),
        name: form.name,
        phone: form.phone,
        email: form.email || "",
        address: form.address || "",
        orders: 0,
        spent: 0,
        lastOrder: "—",
      },
      ...cs,
    ]);
  };

  const handleAddCampaign = (form) => {
    setCampaigns((cs) => [
      {
        id: genId("CMP"),
        name: form.name,
        channel: form.channel,
        status: form.status,
        sent: Number(form.sent) || 0,
        opened: Number(form.opened) || 0,
        clicked: Number(form.clicked) || 0,
      },
      ...cs,
    ]);
  };

  // AI assistant se banaya gaya manual order (e.g. phone/walk-in sale jo
  // owner ne assistant ko bataya). action shape: { items: [{productId, qty}],
  // customer, phone, channel, status }.
  const handleCreateOrder = (action) => {
    const lines = (action.items || [])
      .map((it) => {
        const product = products.find((p) => p.id === it.productId);
        return product ? { productId: product.id, name: product.name, qty: Number(it.qty) || 1, price: product.price } : null;
      })
      .filter(Boolean);
    if (!lines.length) return;

    products.forEach((p) => {
      const line = lines.find((l) => l.productId === p.id);
      if (!line) return;
      const newStock = Math.max(0, p.stock - line.qty);
      if (newStock <= p.threshold && p.stock > p.threshold) notifyLowStock(p, newStock);
    });
    setProducts((ps) =>
      ps.map((p) => {
        const line = lines.find((l) => l.productId === p.id);
        if (line) updateProductRow(p.id, { stock: Math.max(0, p.stock - line.qty) });
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      })
    );

    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const newOrder = {
      id: genId("ORD"),
      customer: action.customer || "Walk-in customer",
      phone: action.phone || "",
      items: lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty })),
      total,
      status: action.status || "pending",
      date: new Date().toLocaleString(),
      channel: action.channel || "AI Assistant",
    };
    setOrders((os) => [newOrder, ...os]);
    insertOrder(newOrder);

    setCustomers((cs) => {
      const exists = cs.some((c) => c.name.toLowerCase() === (newOrder.customer || "").toLowerCase());
      if (exists || !newOrder.customer) return cs;
      return [
        { id: genId("C"), name: newOrder.customer, phone: newOrder.phone || "", email: "", orders: 0, spent: 0, lastOrder: newOrder.date },
        ...cs,
      ];
    });
  };

  const handlePOSCheckout = (cartLines) => {
    products.forEach((p) => {
      const line = cartLines.find((l) => l.productId === p.id);
      if (!line) return;
      const newStock = Math.max(0, p.stock - line.qty);
      if (newStock <= p.threshold && p.stock > p.threshold) notifyLowStock(p, newStock);
    });
    setProducts((ps) =>
      ps.map((p) => {
        const line = cartLines.find((l) => l.productId === p.id);
        if (line) updateProductRow(p.id, { stock: Math.max(0, p.stock - line.qty) });
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      })
    );
    const total = cartLines.reduce((s, l) => s + l.subtotal, 0);
    const newOrder = {
      id: genId("ORD"),
      customer: "Walk-in customer",
      items: cartLines.map((l) => ({ name: l.product.name, qty: l.qty })),
      total,
      status: "delivered",
      date: new Date().toLocaleString(),
      channel: "POS",
    };
    setOrders((os) => [newOrder, ...os]);
    insertOrder(newOrder);
  };

  // Section title now comes from NAV_ITEMS (src/config/app.config.ts) —
  // no separate list to keep in sync when a label changes.
  const sectionTitle = NAV_ITEMS.find((item) => item.key === section)?.label || "Dashboard";

  const renderView = () => {
    switch (section) {
      case "dashboard":
        return <DashboardView orders={orders} products={products} customers={customers} onGoTo={onSectionChange} />;
      case "orders":
        return <OrdersView orders={orders} onUpdateStatus={handleUpdateStatus} />;
      case "inventory":
        return (
          <InventoryView
            products={products}
            onAdd={handleAddProduct}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            openAddSignal={openAddSignal}
          />
        );
      case "customers":
        return <CustomersView customers={customers} orders={orders} onAdd={handleAddCustomer} />;
      case "waitlist":
        return <WaitlistView products={products} />;
      case "pos":
        return <POSView products={products} onCheckout={handlePOSCheckout} />;
      case "accounting":
        return <AccountingView orders={orders} products={products} />;
      case "insights":
        return <BusinessIntelligenceView orders={orders} products={products} />;
      case "marketing":
        return <MarketingView campaigns={campaigns} onAdd={handleAddCampaign} />;
      case "assistant":
        // Deep link / back-button landed here from before this was an
        // overlay — treat it like dashboard underneath, the effect below
        // opens the assistant on top of it.
        return <DashboardView orders={orders} products={products} customers={customers} onGoTo={onSectionChange} />;
      default:
        return null;
    }
  };

  // Deep-link / browser-back compatibility: if `section` is "assistant"
  // (an old link, or history from before this became an overlay), open
  // the assistant overlay full-screen instead of silently showing nothing.
  useEffect(() => {
    if (section === "assistant" && assistantMode === "closed") setAssistantMode("full");
  }, [section]);

  // App-wide keyboard shortcuts. See src/lib/useKeyboardShortcuts.ts.
  const jumpToSection = useCallback(
    (key: string) => {
      if (assistantMode === "full") setAssistantMode("minimized");
      onSectionChange(key);
    },
    [assistantMode, onSectionChange]
  );

  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onQuickBill: () => jumpToSection("pos"),
    onNewProduct: () => {
      jumpToSection("inventory");
      setOpenAddSignal((n) => n + 1);
    },
    onEscape: () => {
      if (searchOpen) setSearchOpen(false);
      else if (notifOpen) setNotifOpen(false);
    },
    onSectionNumber: (n) => {
      const navigable = NAV_ITEMS.filter((i) => i.key !== "assistant");
      const item = navigable[n - 1];
      if (item) jumpToSection(item.key);
    },
  });

  return (
    <div className="min-h-screen bg-app" style={{ fontFamily: bodyFont }}>
      <Sidebar
        active={assistantMode === "full" ? "assistant" : section}
        onSelect={handleSidebarSelect}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        lowStockCount={lowStock.length}
        onLogout={onLogout}
        onGoStore={onGoStore}
      />
      <div className="lg:pl-64">
        <Topbar
          title={sectionTitle}
          onMenuClick={() => setSidebarOpen(true)}
          notifCount={notifications.length}
          onNotifClick={() => setNotifOpen((o) => !o)}
          notifOpen={notifOpen}
          notifications={notifications}
          onBack={section !== "dashboard" ? () => onSectionChange("dashboard") : undefined}
          onSearchClick={() => setSearchOpen(true)}
        />
        <div className="p-4 sm:p-6 max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              variants={fadeSlideUp}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        orders={orders}
        products={products}
        customers={customers}
        onGoTo={jumpToSection}
      />

      {/* Persistent AI Assistant overlay — mounted once, kept alive across
          every section switch so voice input/output never gets cut off by
          an unmount. Only actually rendered once the admin has opened it
          at least once ("closed" state renders nothing). */}
      {assistantMode !== "closed" && (
        <AssistantView
          mode={assistantMode}
          orders={orders}
          products={products}
          customers={customers}
          campaigns={campaigns}
          onAddProduct={handleAddProduct}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onUpdateStatus={handleUpdateStatus}
          onAddCustomer={handleAddCustomer}
          onAddCampaign={handleAddCampaign}
          onCreateOrder={handleCreateOrder}
          onMinimize={() => setAssistantMode("minimized")}
          onExpand={() => setAssistantMode("full")}
          // Voice command like "inventory kholo" — AssistantView already
          // minimizes itself before calling this, so the section switch
          // underneath just happens normally.
          onSectionChange={onSectionChange}
        />
      )}
    </div>
  );
}
