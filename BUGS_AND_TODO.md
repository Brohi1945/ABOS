# AB OS — Bugs, Known Issues & TODO

> **Yeh file kis liye hai:** Is mein wo tamam bugs list hain jo find/fix huay (mostly payment integration debugging session ke dauran), aur wo cheezein jo abhi bhi missing/incomplete hain. Naya kaam shuru karne se pehle yeh file parhein taake pata ho kya already fix ho chuka hai aur kya abhi baaki hai.

**Last updated:** July 19, 2026

---

## 1. Fixed Bugs (Payment Integration Debugging Session)

### 🐛 Bug #1 — `axios` missing dependency (CRITICAL — poori order-placement API crash karti thi)
- **Symptom:** Customer order place karta tha to `/api/place-order` 500 error deta tha. Payment option kahin nazar nahi aata tha — na customer side, na admin side.
- **Root cause:** `@sfpy/node-core` (Safepay SDK) internally `axios` use karta hai, lekin `axios` `package.json` mein dependency ke taur par likha hi nahi tha.
- **Kyun poora function crash hota tha, sirf payment nahi:** `place-order.ts` top-level par `safepayClient.ts` import karta hai, jo `@sfpy/node-core` import karta hai. ES module imports **load-time** par resolve hote hain — jab `axios` nahi milta to poora serverless function process crash ho jata tha (`ERR_MODULE_NOT_FOUND`, exit code 1), order save hona to door ki baat thi.
- **Evidence (Vercel runtime logs):**
  ```
  POST /api/place-order 500
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'axios' imported from
  /var/task/node_modules/@sfpy/node-core/esm/net/AxiosHttpClient.js
  ```
- **Fix:** `package.json` mein `"axios": "^1.7.7"` add ki gayi.
- **Status:** ✅ Fixed aur deploy ho chuka (commit "Add axios dependency to package.json", deployment `dpl_HvN2DELWeNLBuvzzhgR1pxFAFvvd`).
- **Affected endpoints:** `/api/place-order`, `/api/create-payment`, `/api/safepay-webhook` (teeno `safepayClient.ts` import karte hain).

### 🐛 Bug #2 — Safepay client `new` keyword ke bagair call ho raha tha
- **Symptom:** Bug #1 fix hone ke baad bhi payment session banate waqt crash hota (ya hota gaya agar test kiya jata).
- **Root cause:** `api/_lib/safepayClient.ts` ke `getClient()` function mein `Safepay(secretKey, {...})` likha tha — official `@sfpy/node-core` docs ke mutabiq yeh ek class hai, `new Safepay(secretKey, {...})` chahiye.
- **Evidence:** Vercel build log mein TypeScript diagnostic mila:
  ```
  api/_lib/safepayClient.ts(29,10): error TS2348:
  Value of type 'typeof Safepay' is not callable. Did you mean to include 'new'?
  ```
  (`vite build` type-check nahi karta is liye yeh build ko fail nahi karta tha, sirf warning ke taur par dikhta tha — lekin runtime par asal crash deta.)
- **Fix:** `return Safepay(...)` → `return new Safepay(...)`.
- **Status:** ✅ Code fix ho chuka hai (local), **GitHub par push + Vercel redeploy abhi baaki hai** — confirm karna hoga agla message mein.

---

## 2. Operational TODOs (code ke bahar — dashboard/manual steps)

Yeh cheezein code se fix nahi hoti — inhein Vercel/Safepay dashboards mein manually karna hoga:

| # | Task | Kahan | Status |
|---|---|---|---|
| 1 | `PUBLIC_SITE_HOST` env var add karna | Vercel → Settings → Environment Variables | Guide di gayi — user confirm karega |
| 2 | Safepay webhook URL register karna (`/api/safepay-webhook`) | Safepay Dashboard → Developers → Webhooks | Abhi tak nahi — Claude ke paas Safepay dashboard access nahi hai |
| 3 | `SAFEPAY_SECRET_KEY` / `SAFEPAY_PUBLIC_KEY` Vercel mein set hain ya nahi — verify karna | Vercel → Settings → Environment Variables | Verify karna baaki hai |
| 4 | Live end-to-end sandbox test (real order + real payment) | Live site par manually | Claude ka network access disabled hai — sirf user hi test kar sakta hai |
| 5 | PayPak provider add karna | — | **Decision pending** — abhi scope se bahar |

---

## 3. Pehle se Known Gaps (asal README se, abhi bhi valid)

- **Customers Supabase mein persist nahi hote** — sirf React state mein hain, refresh par lost ho jate hain. Products/orders/waitlist theek persist hote hain.
- **Waitlist reservation expiry ke liye koi cron nahi** — sirf app load hone par check hota hai (`expireStaleReservations`).
- **RLS policies review nahi hui** — confirm karna hai ke anon-key se koi over-permissive write path na bache (zyada tar writes ab service-role server functions se hoti hain).
- **Admin registration approval-less hai** — OTP verify karte hi full admin access mil jata hai, koi owner-approval gate nahi.
- **`api/` folder abhi bhi partially `.js`** (`chat.js`, `notify.js`, `whatsapp.js`, `whatsapp-webhook.js`, kuch `_lib/*.js`) — `.ts` conversion complete nahi hai.
- **`tsconfig.json` mein `strict: false`** aur `vite build` type-check nahi karta — jaisa Bug #2 mein dikha, yeh type-errors ko production tak pahuncha sakta hai bina warning ke rukte.

---

## 4. Testing Checklist (jab live test karna ho)

Yeh manually check karna hoga (Claude ka network disabled hai, is liye khud user ko karna hoga):

- [ ] Store se ek order place karein (valid Pakistani phone number ke saath, jaise `03XXXXXXXXX`)
- [ ] Confirm karein order Supabase `orders` table mein save hua (200 response, 500 nahi)
- [ ] Confirm karein `checkoutUrl` response mein aaya
- [ ] Checkout URL open karke Safepay sandbox par test payment complete karein
- [ ] Confirm karein `/api/safepay-webhook` fire hua aur `orders.payment_status` "paid" ho gaya (Supabase Table Editor se check karein)
- [ ] Admin OrdersView mein order open karke `PaymentStatusBadge` "paid" dikhayein
- [ ] Admin OrdersView se "Send Payment Link" button test karein (manual link generation flow)
- [ ] Order confirmation email aaya ya nahi check karein (agar email diya ho checkout par)

---

## 5. Priority Order (agla kya karna chahiye)

1. **Bug #2 ka fix GitHub par push karke deploy karna** (sabse zaroori — is ke bagair payment kabhi kaam nahi karega)
2. `SAFEPAY_SECRET_KEY` / `SAFEPAY_PUBLIC_KEY` Vercel mein verify karna
3. Safepay Dashboard mein webhook URL register karna
4. Ek real sandbox order test karna (checklist upar)
5. Phir baaki known gaps (customers table, RLS, admin approval) par kaam
