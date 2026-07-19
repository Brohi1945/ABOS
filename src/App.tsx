import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { bodyFont, fontImportUrl, ThemeProvider } from "./theme";
import { fadeSlideUp } from "./animations/variants";
import { seedProducts, seedOrders, seedCustomers } from "./lib/seedData";
import { genId } from "./lib/utils";
import { notifyNewOrder, notifyLowStock } from "./lib/notify";
import { toastSuccess, toastError } from "./lib/toast";
import {
  fetchProducts,
  fetchOrders,
  seedIfEmpty,
  supabase,
} from "./supabaseClient";
import { expireStaleReservations, convertWaitlistIfMatched, joinWaitlist } from "./lib/waitlist";
import LandingScreen from "./screens/Landing";
import LoginScreen from "./screens/Login";
import AdminApp from "./screens/AdminApp";
import StoreScreen from "./screens/Store";
import { TOAST_POSITION } from "./animations/config";

export default function BusinessAutomationSystem() {
  const [screenStack, setScreenStack] = useState(["landing"]);
  const screen = screenStack[screenStack.length - 1];
  const isAdmin = screen.startsWith("admin:");
  const adminSection = isAdmin ? screen.slice(6) : "dashboard";

  const [products, setProducts] = useState(seedProducts());
  const [orders, setOrders] = useState(seedOrders());
  const [placedOrders, setPlacedOrders] = useState([]);
  const [customers, setCustomers] = useState(seedCustomers());

  // 🔒 SECURITY FIX: admin panel ka asal lock. "session" states:
  //   undefined = abhi check ho raha hai (kuch render mat karo)
  //   null      = koi login nahi hai
  //   object    = genuinely logged-in Supabase session hai
  const [session, setSession] = useState(undefined);

  const navigate = (next) => {
    setScreenStack((s) => {
      const ns = [...s, next];
      window.history.pushState({ depth: ns.length }, "");
      return ns;
    });
  };

  const switchSection = (next) => {
    const current = screenStack[screenStack.length - 1];
    const isCurrentDashboard = current === "admin:dashboard";
    const isNextDashboard = next === "admin:dashboard";

    if (isCurrentDashboard && !isNextDashboard) {
      setScreenStack((s) => {
        const ns = [...s, next];
        window.history.pushState({ depth: ns.length }, "");
        return ns;
      });
      return;
    }

    if (!isCurrentDashboard && isNextDashboard) {
      window.history.back();
      return;
    }

    setScreenStack((s) => {
      const ns = [...s.slice(0, -1), next];
      window.history.replaceState({ depth: ns.length }, "");
      return ns;
    });
  };

  const goBack = () => {
    window.history.back();
  };

  const resetTo = (start) => {
    setScreenStack([start]);
    window.history.replaceState({ depth: 1 }, "");
  };

  useEffect(() => {
    window.history.replaceState({ depth: 1 }, "");
    const onPopState = () => {
      setScreenStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 💳 Safepay hosted checkout se wapas is site par redirect hone par
  // (redirectUrl/cancelUrl — see api/place-order.ts, api/create-payment.ts)
  // customer ko ek chhota acknowledgement dikhate hain. Yeh SIRF cosmetic
  // hai — asal payment_status hamesha api/safepay-webhook.ts (server-side,
  // Safepay se dobara verify karke) update karta hai, is URL query param
  // par kabhi bharosa nahi karte.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");
    const orderId = params.get("order_id");
    if (!paymentResult || !orderId) return;

    if (paymentResult === "success") {
      toastSuccess(`Payment mil gaya! Order ${orderId} confirm ho raha hai.`);
    } else if (paymentResult === "cancelled") {
      toastError(`Payment cancel/fail ho gaya — order ${orderId} abhi bhi Cash on Delivery se ban sakta hai, ya dobara try karein.`);
    }

    // URL se yeh query params hata do taake refresh par dobara toast na aaye.
    params.delete("payment");
    params.delete("order_id");
    const newSearch = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
  }, []);

  // 🔒 SECURITY FIX: real Supabase session track karo — sirf isi ke
  // through admin panel unlock hota hai, koi UI-navigation trick se
  // nahi. Login/logout hone par yeh khud-b-khud update ho jata hai.
  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      if (data?.session) {
        setScreenStack((s) => (s[0] === "landing" && s.length === 1 ? ["admin:dashboard"] : s));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // 🔒 SECURITY FIX: agar koi "admin:*" screen par hai lekin real
  // session nahi hai (chahe URL/history se pahunche ho), turant login
  // par bhej do. Yeh asal "lock" hai — sirf UI chhupana nahi.
  useEffect(() => {
    if (session === undefined) return; // abhi check ho raha hai, sabar karo
    if (isAdmin && !session) {
      resetTo("login");
    }
  }, [isAdmin, session]);

  const updateProductField = (id, fields) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  };

  useEffect(() => {
    (async () => {
      await seedIfEmpty(seedProducts(), seedOrders());
      const [liveProducts, liveOrders] = await Promise.all([fetchProducts(), fetchOrders()]);
      if (liveProducts) setProducts(liveProducts);
      if (liveOrders) setOrders(liveOrders);
      // 48hr se expire ho chuki waitlist reservations release karo aur
      // agle customer ko offer karo. Koi cron abhi nahi hai isliye yeh
      // sirf app open hone par check hota hai (prototype ke liye theek).
      if (liveProducts) await expireStaleReservations(liveProducts, updateProductField);
    })();
  }, []);

  // 🔒 SECURITY FIX (Stage C): order ab client-side anon key se
  // seedha insert nahi hoti — /api/place-order (service-role key)
  // se save hoti hai, jo stock validate karta hai aur total khud
  // products ki asal price se calculate karta hai (client se aane
  // wale price/total par bharosa nahi karta). Yahan sirf optimistic
  // UI update hota hai taake customer ko turant feedback mile.
  //
  // 💳 Payment integration: server jo order wapas bhejta hai usi mein
  // asal DB id + payment_status hoti hai (client ka `order.id` sirf
  // optimistic/random hai) — isi liye response aane ke baad optimistic
  // entry ko (object-reference se dhoondh kar) server ke order se
  // reconcile karte hain. Warna "Get Payment Link" jaisi koi bhi cheez
  // jo order.id par depend karti hai client ke fake id ke sath DB mein
  // order dhoondhne ki koshish karegi aur "Order nahi mila" milega.
  // checkoutUrl bhi yahi se caller (Store.tsx) tak wapas jata hai.
  const handlePlaceOrder = async (order) => {
    products.forEach((p) => {
      const line = order.items.find((it) => it.productId === p.id);
      if (!line) return;
      const newStock = Math.max(0, p.stock - line.qty);
      if (newStock <= p.threshold && p.stock > p.threshold) notifyLowStock(p, newStock);
    });
    setProducts((ps) =>
      ps.map((p) => {
        const line = order.items.find((it) => it.productId === p.id);
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      })
    );
    setOrders((os) => [order, ...os]);
    setPlacedOrders((os) => [order, ...os]);
    notifyNewOrder(order);
    setCustomers((cs) => {
      const exists = cs.some((c) => c.name.toLowerCase() === (order.customer || "").toLowerCase());
      if (exists || !order.customer) return cs;
      return [
        {
          id: genId("C"),
          name: order.customer,
          phone: order.phone || "",
          email: order.email || "",
          orders: 0,
          spent: 0,
          lastOrder: order.date,
        },
        ...cs,
      ];
    });

    let serverOrder = order;
    let checkoutUrl = null;
    let success = false;

    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: order.items,
          customer: order.customer,
          phone: order.phone,
          email: order.email,
          address: order.address,
          channel: order.channel,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        console.error("place-order API failed:", data);
      } else {
        success = true;
        checkoutUrl = data.checkoutUrl || null;
        // Server ki id/status/payment_status hi asal truth hai — usi
        // reference wale optimistic entries ko isi se replace karo.
        serverOrder = { ...order, ...data.order };
        setOrders((os) => os.map((o) => (o === order ? serverOrder : o)));
        setPlacedOrders((os) => os.map((o) => (o === order ? serverOrder : o)));
      }
    } catch (err) {
      console.error("place-order API error:", err.message);
    }

    // Agar yeh order kisi waitlist reservation se match karta hai
    // (same product + same phone), to us reservation ko "converted"
    // mark karo aur reserved stock free karo. serverOrder.id use karte
    // hain (client ka optimistic id nahi) taake asal DB record match ho.
    if (serverOrder.phone) {
      serverOrder.items.forEach((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (product) convertWaitlistIfMatched(product, serverOrder.phone, serverOrder.id, updateProductField);
      });
    }

    return { success, order: serverOrder, checkoutUrl };
  };

  const handleJoinWaitlist = async (product, customerName, phone, qty = 1) => {
    return joinWaitlist({ product, customerName, phone, qty });
  };

  return (
    <ThemeProvider>
    <div style={{ fontFamily: bodyFont }}>
      <Toaster position={TOAST_POSITION} gutter={8} />

      <style>{`
        @import url('${fontImportUrl}');
        input::placeholder, textarea::placeholder { color: var(--color-text-muted); }
        @keyframes drawerIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-drawer-in { animation: drawerIn 0.22s ease-out; }
        @keyframes modalIn { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-modal-in { animation: modalIn 0.18s ease-out; }
      `}</style>

      <AnimatePresence mode="wait">
        {screen === "landing" && (
          <motion.div key="landing" variants={fadeSlideUp} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
            <LandingScreen onLogin={() => navigate("login")} onBrowseStore={() => navigate("store")} />
          </motion.div>
        )}
        {screen === "login" && (
          <motion.div key="login" variants={fadeSlideUp} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
            <LoginScreen
              onBack={goBack}
              onLoginAs={(role) => navigate(role === "admin" ? "admin:dashboard" : "store")}
            />
          </motion.div>
        )}
        {isAdmin && session && (
          <motion.div key="admin" variants={fadeSlideUp} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
            <AdminApp
              section={adminSection}
              onSectionChange={(s) => switchSection("admin:" + s)}
              onLogout={() => { supabase?.auth.signOut(); resetTo("landing"); }}
              onGoStore={() => navigate("store")}
              products={products}
              setProducts={setProducts}
              orders={orders}
              setOrders={setOrders}
              customers={customers}
              setCustomers={setCustomers}
            />
          </motion.div>
        )}
        {screen === "store" && (
          <motion.div key="store" variants={fadeSlideUp} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
            <StoreScreen
              products={products}
              onBack={goBack}
              onLogin={() => navigate("login")}
              placedOrders={placedOrders}
              onPlaceOrder={handlePlaceOrder}
              onJoinWaitlist={handleJoinWaitlist}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ThemeProvider>
  );
}
