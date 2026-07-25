# Agentic LLM Prompt — QuickRxRecord v4 SPA/PWA

## Instructions to LLM Agent

You are a senior full-stack software engineer tasked with building **QuickRxRecord v4** — a pharmacy/clinic inventory and patient management system, rebuilt as a Single Page Application (SPA) with Progressive Web App (PWA) capabilities.

**Follow these rules strictly:**

1. **You are building ONE analysis file at a time.** Complete the full implementation of the current analysis file before stopping. Wait for the user to say "continue" before proceeding to the next analysis file.
2. **Use Bahasa Melayu Malaysia** for all user-facing text (labels, buttons, toasts, error messages, placeholders).
3. **Use Asia/Kuala_Lumpur timezone** for all date/time processing and display.
4. **Preserve ALL functionality, UX flows, and visual design** described in the analysis files. Do not simplify or omit features.
5. **Use the exact color values, spacing, typography sizes, border radii, and shadows** specified in the analysis files.
6. **Write production-quality code** — properly typed, well-structured, and following best practices.
7. The GitHub repository is `fetreney2000/quickrxrecordv4`.
8. The application will be hosted on Vercel (Hobby tier).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build Tool | **Vite** |
| Framework | **React 18+** with TypeScript |
| Routing | **React Router v6** (createBrowserRouter or `<BrowserRouter>`) |
| Data Fetching | **TanStack Query** (React Query v5) |
| Global State | **Zustand** |
| Styling | **Tailwind CSS** |
| UI Components | **shadcn/ui** (Radix UI primitives) |
| Backend/DB | **Supabase** (PostgreSQL) |
| Animations | **Framer Motion** |
| Notifications | **sonner** (toast) |
| Icons | **lucide-react** |
| PWA | **vite-plugin-pwa** (service worker, manifest) |
| Fonts | **Inter** + **Roboto** (via `@fontsource/inter` and `@fontsource/roboto`) |
| Date/Time | `date-fns` or native `Intl.DateTimeFormat` with `Asia/Kuala_Lumpur` |
| Export | `exceljs` + `jspdf` + `jspdf-autotable` (dynamic imports) |

---

## Project Structure

```
quickrxrecordv4/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── package.json
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── favicon.ico
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router + Providers
│   ├── index.css                   # Tailwind directives + CSS tokens
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client singleton
│   │   ├── auth-store.ts           # Zustand auth store
│   │   ├── permissions.ts          # hasPermission() function
│   │   ├── utils.ts               # formatDate, toTitleCase, formatMyKad, formatPhone, getKLDate, toTitleCaseKeepAcronyms
│   │   └── query-provider.tsx      # QueryClientProvider wrapper
│   ├── hooks/
│   │   ├── use-media-query.ts      # isMobile detection
│   │   └── use-auth.ts            # Auth hook wrapping Zustand store
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── dashboard-layout.tsx # Auth gate + sidebar + header + mobile nav
│   │   │   ├── sidebar.tsx         # Desktop sidebar
│   │   │   ├── header.tsx          # Sticky header with global patient search
│   │   │   ├── mobile-nav.tsx      # Bottom mobile navigation
│   │   │   └── breadcrumb.tsx      # Breadcrumb component
│   │   ├── pesakit/
│   │   │   └── merge-dialog.tsx    # Patient merge dialog
│   │   └── pengurusan/
│   │       └── lookup-manager.tsx  # Generic CRUD for lookup tables
│   ├── pages/
│   │   ├── LoginPage.tsx           # /login
│   │   ├── ForgotPasswordPage.tsx  # /lupa-kata-laluan
│   │   ├── DashboardPage.tsx       # / (papan pemuka)
│   │   ├── PatientListPage.tsx     # /pesakit
│   │   ├── PatientDetailPage.tsx   # /pesakit/:id
│   │   ├── QuickDispensePage.tsx   # /pantas
│   │   ├── StockListPage.tsx       # /stok
│   │   ├── StockDetailPage.tsx     # /stok/:id
│   │   ├── ReportPage.tsx          # /laporan
│   │   ├── ManagementPage.tsx      # /pengurusan
│   │   ├── ProfilePage.tsx         # /profil (simple profile view with logout)
│   │   └── CopyrightPage.tsx       # /hakcipta
│   └── types/
│       └── index.ts               # All TypeScript interfaces
```

---

## Implementation Order (by Analysis File)

Build the application in this exact order. After each build phase, **STOP and wait** for the user to say `"continue"` before proceeding.

### Phase 1: Foundation & App Shell
**Analysis file:** `ANALISIS_APP_SHELL.md`

Setup tasks:
1. Initialize Vite React TypeScript project
2. Install ALL dependencies
3. Configure Tailwind CSS with the complete CSS token system from the analysis
4. Configure `vite-plugin-pwa` with manifest and service worker
5. Set up shadcn/ui (init + add required components)
6. Create Supabase client (`lib/supabase.ts`)
7. Create Zustand auth store (`lib/auth-store.ts`)
8. Implement `hasPermission()` function (`lib/permissions.ts`)
9. Implement ALL utility functions (`lib/utils.ts`)
10. Create `QueryProvider` wrapper
11. Create `types/index.ts` with ALL TypeScript interfaces

Pages/components to build:
12. Root App with BrowserRouter, QueryProvider, AuthProvider, Toaster
13. **DashboardLayout** — Auth gate (loading spinner / redirect to /login)
14. **Sidebar** — 7 navigation items with RBAC filtering, logo, profile section with logout, colored dot indicators, orbs animation
15. **Header** — Sticky glass header with patient search (debounced 300ms, min 2 chars, dropdown results)
16. **MobileNav** — Bottom fixed nav, 8 icon-only items, colored active indicators
17. **Breadcrumb** — Dynamic breadcrumb with `setNavSource` pattern

**STOP here.** Output: running Vite dev server with App Shell fully functional.

---

### Phase 2: Skema Pangkalan Data
**Analysis file:** `ANALISIS_SKEMA_PANGKALAN_DATA.md`

1. Run ALL 8 migration SQL files against Supabase project in order: 001 → 002 → 004 → 005 → 006 → 007 → 008 → 010
2. Create missing `count_active_assignments` RPC function
3. Add missing `dikemaskini_oleh` column to `dose_history` table
4. Verify all 14 tables exist with correct columns, indexes, triggers
5. Seed lookup tables with data from migration 007

**STOP here.** Output: Supabase project with complete schema.

---

### Phase 3: Login & Lupa Kata Laluan
**Analysis file:** `ANALISIS_LOGIN_DAN_LUPA_KATA_LALUAN.md`

1. Create API routes (Vite server-side or Supabase Edge Functions):
   - `POST /api/login`
   - `GET /api/session`
   - `DELETE /api/session`
   - `POST /api/reset-request`
2. **LoginPage** — Split layout (branding left + card right on desktop), 4 animated orbs, 20 floating particles, grid pattern, glass card with gradient border, animated accent bar, RxLogo SVG, username/password fields with focus states, show/hide password toggle, "Lupa kata laluan?" link, staggered entry animations
3. **ForgotPasswordPage** — Single card layout, 3 orbs, 16 particles, KeyRound icon, single field form, SuccessState component with green theme, 409 duplicate handling

**STOP here.** Output: full auth flow working.

---

### Phase 4: Papan Pemuka (Dashboard)
**Analysis file:** `ANALISIS_PAPAN_PEMUKA.md`

1. **DashboardPage** — Header with user greeting + role badge + system status badge with pulsing dots
2. 6 statistic cards with gradient backgrounds, CSS counting animation (`AnimatedNumber` + `CountingNumber`), role-based filtering
3. Expiry dashboard section (Pentadbir & Penjaga Stor only) — color-coded summary badges + 6-column expiry table

**STOP here.**

---

### Phase 5: Senarai Pesakit
**Analysis file:** `ANALISIS_SENARAI_PESAKIT.md`

1. **PatientListPage** — Glass card, gradient border, search bar, count badge, sortable 5-column table (dual markup: desktop grid + mobile cards), sliding window pagination (100/page)
2. Add Patient dialog — 6 fields with auto-format, duplicate detection (debounced 600ms), amber warning with link
3. Navigation: `setNavSource` for breadcrumb context, auto-redirect to detail after registration

**STOP here.**

---

### Phase 6: Butiran Pesakit
**Analysis file:** `ANALISIS_BUTIRAN_PESAKIT.md`

This is the most complex page. Build carefully:
1. **PatientDetailPage** — Info card (view/edit modes), 4 stat cards, fields with auto-format
2. Items section — FoldableCard, sortable assignment list (50/page), expand each with details + dose history + supply history
3. All dialogs: Add Item (search + select + dose), Supply (FEFO batch picker, quantity, duration), Update Dose, Stop Assignment, Deactivate Patient, Edit Supply Record, Delete Supply
4. **MergeDialog** — 2-step wizard (search → confirm), complex merge logic
5. All mutations with proper query invalidation

**STOP here.**

---

### Phase 7: Dispen Pantas
**Analysis file:** `ANALISIS_DISPEN_PANTAS.md`

1. **QuickDispensePage** — Linear 3-step flow (Search Patient → Select Item → Dispense)
2. Patient search with auto-focus, dropdown results (orange theme)
3. Patient card (green) with assigned items list + "Item Kerap" section
4. "Daftar Item Baharu" dialog with quota checking
5. Dispense form — FEFO batch picker, dose (auto-filled, read-only if from assignment), quantity, duration, notes
6. Success banner (auto-dismiss 2.5s)
7. Keyboard shortcuts (Escape, Enter)
8. POST /api/supply integration

**STOP here.**

---

### Phase 8: Pengurusan Inventori
**Analysis file:** `ANALISIS_PENGURUSAN_INVENTORI.md`

1. **StockListPage** — Glass card with purple theme, sortable 5-column table (50/page), stock badges (green/red), add item dialog with 8 fields
2. **StockDetailPage** — 4 FoldableCard sections:
   - Item Info (view/edit modes, 4 stat cards)
   - Patients Using Item (search + defaulter filter 3/6/9/12/24 months)
   - Batch List (inline edit quantity, dispose with reason codes)
   - Transaction History (5 filters, merged supply + adjustment sources, 4 stat cards, export Excel/PDF)

**STOP here.**

---

### Phase 9: Laporan
**Analysis file:** `ANALISIS_LAPORAN.md`

1. **ReportPage** — Segmented tab control (Inventory / Transactions)
2. Tab Inventory — all items with total stock, "Stok Rendah" badge, export Excel/PDF
3. Tab Transactions — 500 latest supplies (100 displayed), 7-column table, export Excel/PDF
4. Generic `exportToExcel` and `exportToPDF` utility functions

**STOP here.**

---

### Phase 10: Pengurusan
**Analysis file:** `ANALISIS_PENGURUSAN.md`

1. **ManagementPage** — Admin-only, 3 Tabs (Users / Reset Requests / Lookups)
2. Users tab — expandable rows with inline edit, toggle active, reset password dialogs
3. Reset Requests tab — approval cards with "Sah & Reset" combined action
4. **LookupManager** component — generic CRUD for item_categories, item_forms, supply_durations (inline edit, add dialog, delete confirmation)

**STOP here.**

---

### Phase 11: Hak Cipta & Profil
**Analysis files:** `ANALISIS_HAKCIPTA.md` + Profil (simple page from sidebar navigation)

1. **CopyrightPage** — Static developer info card with glass styling
2. **ProfilePage** — Simple page showing current user info with logout button (for mobile users)

**STOP here.** Application complete.

---

## Design System Reference

### Color Palette
```
--background: #f0f2f5
--foreground: #1c1e21
--primary: #1877f2 (Facebook Blue)
--destructive: #e41e3f
--success: #42b72a
--warning: #f0ad4e
--muted: #f0f2f5
--muted-foreground: #65676b
--border: #dddfe2
--ring: #1877f2

Sidebar bg: linear-gradient(180deg, #0c1329, #0a0e27, #0d1117)
Login bg: #0a0e27
```

### Page-Specific Accent Colors
| Page | Accent | Hex |
|------|--------|-----|
| Dashboard | Blue | `#3b82f6` |
| Quick Dispense | Orange | `#f0932b` |
| Patients | Green (sidebar) / Blue (pages) | `#10b981` / `#1877f2` |
| Inventory | Purple | `#7c3aed` |
| Reports | Red | `#f43f5e` |
| Management | Cyan | `#06b6d4` |
| Copyright | Red | `#f43f5e` |

### Typography
- Font family: Inter (primary), Roboto (fallback)
- Page titles: 22px / 700
- Subtitles: 13px / 500 / `#65676b`
- Table headers: 11px / 600 / uppercase / 0.05em letter-spacing
- Body text: 13–14px
- Card stat values: 18–30px / 700–800

### Border Radii
- Cards: 16px
- Buttons: 12px
- Inputs: 10–12px
- Dialogs: 16px
- Icons containers: 8–14px

### Glass Card Pattern
```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.5);
box-shadow: 0 4px 16px rgba(0,0,0,0.06);
```

### Gradient Border Pattern (mask-composite technique)
Used on most main cards. Implement via pseudo-element.

---

## Auth & RBAC System

### Roles
```
Pentadbir (Admin) — Full access
Penjaga Stor (Storekeeper) — Manage inventory, patients, supply
Kakitangan Farmasi (Pharmacy Staff) — Manage patients, supply
Kakitangan Klinik (Clinic Staff) — View only
```

### Permissions Map
```typescript
const PERMISSIONS = {
  Pentadbir: ["manage_users", "manage_items", "manage_patients", "manage_supply", "view_reports", "export_reports", "merge_patients", "manage_batches", "view_items", "view_patients", "manage_assignments"],
  "Penjaga Stor": ["manage_items", "manage_patients", "manage_supply", "view_reports", "export_reports", "merge_patients", "manage_batches", "view_items", "view_patients", "manage_assignments"],
  "Kakitangan Farmasi": ["manage_patients", "manage_supply", "view_reports", "export_reports", "view_items", "view_patients", "manage_assignments"],
  "Kakitangan Klinik": ["view_items", "view_patients"],
};
```

### Session Storage
- Store profile in Zustand (persisted to localStorage)
- Key: `"quickrx_session"`
- Profile shape: `{ id, nama, jawatan, peranan, nama_pengguna, aktif, created_at, updated_at }`

---

## Supabase Configuration

### Environment Variables (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### API Routes (Vite + Express middleware or Supabase Edge Functions)
The original app uses Next.js API routes. Since this is a Vite SPA, you have two options:
1. **Supabase Edge Functions** for `/api/login`, `/api/session`, `/api/create-user`, `/api/reset-password`, `/api/reset-request`, `/api/supply`
2. **Vite proxy** to a separate backend (if needed)

**Recommended:** Use Supabase Edge Functions for all API endpoints. Create an `edge-functions/` directory with each function, or use Supabase CLI to deploy them.

### Database Functions Already Defined in Migrations
- `process_supply(...)` — Atomic supply transaction
- `merge_patients(...)` — Merge duplicate patients
- `update_password_hash(...)` — Admin password reset
- `update_updated_at()` — Auto timestamp trigger

### Missing Function (Create Manually)
```sql
CREATE OR REPLACE FUNCTION count_active_assignments()
RETURNS TABLE(item_id UUID, active_count BIGINT) AS $$
  SELECT item_id, COUNT(*)::BIGINT
  FROM patient_item_assignments
  WHERE aktif = true
  GROUP BY item_id;
$$ LANGUAGE sql STABLE;
```

---

## PWA Configuration (vite-plugin-pwa)

### manifest.json
```json
{
  "name": "QuickRxRecord v4",
  "short_name": "QuickRx",
  "description": "Sistem pengurusan inventori dan pesakit untuk klinik/farmasi - Versi 4.0",
  "theme_color": "#18181b",
  "background_color": "#f0f2f5",
  "display": "standalone",
  "start_url": "/",
  "icons": [...]
}
```

---

## Responsive Breakpoints
- Desktop sidebar: ≥769px
- Mobile nav: ≤768px
- Patient table desktop: ≥640px
- Patient table mobile: <640px
- Dashboard grid: 3 cols (desktop) → 2 cols (tablet ≤768px) → 1 col (phone ≤480px)

---

## Final Verification Checklist

After ALL phases complete, verify:
- [ ] All analysis files have been fully implemented
- [ ] All 14 database tables exist and are functional
- [ ] Auth flow works (login → session → logout → forgot password)
- [ ] RBAC correctly hides/shows navigation items and actions
- [ ] All CRUD operations work for patients, items, batches
- [ ] Supply flow works end-to-end (select patient → select item → dispense → stock deducted)
- [ ] Reports export to Excel and PDF correctly
- [ ] PWA installs and works offline
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] All texts are in Bahasa Melayu Malaysia
- [ ] All dates/times use Asia/Kuala_Lumpur timezone
- [ ] Deployed successfully to Vercel (Hobby tier) from `fetreney2000/quickrxrecordv4`

---

## Key Reminders for the LLM Agent

1. **Do not skip details.** Every animation, every border radius, every color value from the analysis files must be implemented.
2. **The analysis files are your specification.** If the analysis says a card has `border-radius: 16px`, use exactly that. If it says the spinner is 32×32px with a 3px border, implement exactly that.
3. **Stop after each phase.** Do NOT proceed to the next phase until the user says "continue".
4. **Declare completion clearly.** At the end of each phase, output a summary of what was built and ask the user to say "continue" for the next phase.
5. **Handle the dose_history.dikemaskini_oleh column mismatch** — the column is referenced in app code but missing from the schema. Add it in Phase 2.