# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TenderHUB by SU_10 is a construction tender management portal for Bill of Quantities (BOQ) and bidding workflows. Currently in initial development with UI foundation complete but backend integration pending.

**Language Convention**: Russian UI, English code, Russian commit messages
**Current State**: React + Ant Design UI shell with Supabase schema partially defined
**Organization**: SU-10 (Construction Company)
**Branding**: Complete design system documented in BRANDING.md
**Logo Preview**: http://localhost:3000/logo-preview.html

## Development Commands

```bash
# Core development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000, auto-opens)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build
npm run lint         # ESLint with zero-warning enforcement

# Database (when Supabase client is added)
supabase db push     # Apply migrations
supabase db reset    # Reset local database
```

## 🚨 CRITICAL DATABASE RULES 🚨

```
DATABASE SINGLE SOURCE OF TRUTH:
supabase/schemas/prod.sql

- ALWAYS verify schema in prod.sql before ANY database work
- NEVER trust TypeScript types over prod.sql definitions
- prod.sql contains ALL Supabase system tables and extensions
- Business tables defined in migrations (001, 002, 003)
```

**Current Tables**:
- `tenders` - Main tender records with currency rates
- `material_names` - Material name library with units
- `work_names` - Work name library with units
- `locations` - Construction site locations
- `cost_categories` - Cost category definitions
- `detail_cost_categories` - Detailed cost items per location
- ENUM: `unit_type` ('шт', 'м', 'м2', 'м3', 'кг', 'т', 'л', 'компл', 'м.п.')

## Architecture & Patterns

### Component Hierarchy
```
App.tsx
└── ThemeProvider (context)
    └── ConfigProvider (Ant Design)
        └── Routes
            └── MainLayout
                ├── Sider (collapsible navigation)
                ├── Header (search, theme, notifications)
                └── Content (page routing via Outlet)
```

### Implemented Routes
- `/` and `/dashboard` - Feature card grid with 8 modules (✅ complete)
- `/admin/nomenclatures` - Materials, Works, Locations, Cost Categories (✅ UI complete, mock data)
- `/admin/tenders` - Tender management table (✅ UI complete, empty data)
- `/admin/construction_cost` - Cost calculation interface (✅ UI complete, mock data)
- `/positions`, `/commerce`, `/library`, `/costs`, `/users`, `/settings` - Placeholder pages

### Theme System
- **Context**: `src/contexts/ThemeContext.tsx`
- **Storage**: localStorage key `tenderHub_theme`
- **Colors**: Primary `#10b981` (emerald)
- **Dark**: Black background (`#000`), sidebar `#0a0a0a`
- **Light**: Ant Design defaults

### Custom SVG Icons
Two parameterized components in `src/components/Icons/`:
- `LogoIcon` - Building + crane design (sidebar)
- `HeaderIcon` - Modern house design (dashboard header)

Both accept: `size`, `color`, `className` props

## Tech Stack Reality Check

### Currently Installed (package.json)
```json
{
  "dependencies": {
    "@ant-design/icons": "^6.1.0",
    "antd": "^5.28.0",
    "dayjs": "^1.11.19",    // Date manipulation library
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.9.5"
  }
}
```

### NOT Yet Installed (but planned)
- @supabase/supabase-js
- @tanstack/react-query
- react-hook-form + yup
- xlsx-js-style
- @dnd-kit/sortable
- react-window

**Important**: Verify package.json before using any library

## Code Constraints

### File Size Rule
**STRICT**: All files MUST be ≤ 600 lines
- Current largest: Tenders.tsx (425 lines), ConstructionCost.tsx (400 lines)
- Split large files into modules with barrel exports

### TypeScript Configuration
- Target: ES2020, strict mode
- No unused locals/parameters
- No implicit any (1 violation at MainLayout.tsx:88)
- React JSX transform (no React import needed)

### ESLint Rules
- Zero warnings enforced (`max-warnings: 0`)
- Current issues:
  - MainLayout.tsx:88 - `any` type needs fixing
  - ThemeContext.tsx:45 - Export warning

### Git Conventions
- **Commits**: Russian, imperative mood
- **Examples**: "Добавить валидацию форм", "Исправить ошибку в расчетах"
- **Branches**: feature/, fix/, refactor/ prefixes

## Dashboard Design System

### Card Grid (8 features)
Each card has:
- Gradient header (135deg angle)
- 64px circular icon container
- Hover: translateY(-6px) with shadow
- Responsive: xs={24} sm={12} lg={6}

### Color Assignments
1. Дашборд - #1a5f7a → #159957
2. Позиции заказчика - #10b981 → #059669
3. Коммерция - #06b6d4 → #0891b2
4. Библиотеки - #14b8a6 → #0d9488
5. Затраты - #34d399 → #10b981
6. Администрирование - #0284c7 → #0369a1
7. Пользователи - #0891b2 → #0e7490
8. Настройки - #22c55e → #16a34a

## Database Migration Status

### Implemented (in migrations/)
1. `001_create_tenders_table.sql` - Core tender entity with currency rates
2. `002_create_material_work_tables.sql` - Name libraries with units
3. `003_create_location_and_cost_categories_tables.sql` - Locations and cost categories

### Planned but Not Created
- users (5 roles: administrator, moderator, engineer, manager, director)
- organizations, material_categories, materials, works
- boq_sections, boq_positions (hierarchical BOQ)
- tender_participants, audit_log, comments

### Key Database Patterns
- UUID primary keys with uuid_generate_v4()
- created_at/updated_at with automatic triggers
- RLS policies defined but currently disabled
- Foreign keys to auth.users for ownership

## Implementation Gaps

### Backend Integration Missing
1. No Supabase client initialization
2. No API service layer
3. No authentication UI
4. No data fetching/mutation

### UI Implementation Status
**Fully Implemented:**
- /dashboard - 8-card feature grid with gradients and hover effects
- /admin/nomenclatures - Tabbed interface for Materials, Works, Locations, Cost Categories
- /admin/tenders - Complex tender management table with filters and actions
- /admin/construction_cost - Cost calculations with statistics and deviation analysis

**Placeholder Pages:**
- /positions - BOQ management
- /commerce - Commercial calculations
- /library - Materials/works catalog
- /costs - Construction costs
- /users - User management
- /settings - System configuration

## Next Development Steps

### Immediate Fixes
1. Fix TypeScript `any` at MainLayout.tsx:88
   ```typescript
   import type { MenuClickEventHandler } from 'antd/es/menu/interface';
   const handleMenuClick: MenuClickEventHandler = (e) => navigate(e.key);
   ```

2. Fix ESLint warning in ThemeContext.tsx (extract hook to separate file)

### Supabase Integration
1. Install: `npm install @supabase/supabase-js`
2. Create `.env.local`:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
3. Create `src/lib/supabase.ts` client
4. Implement auth pages and user context

### Feature Development Priority
1. Complete remaining table migrations
2. Build /positions page (BOQ CRUD)
3. Build /library page (materials/works)
4. Add react-hook-form for data entry
5. Implement TanStack Query for server state

## Vite Configuration Notes

```typescript
// vite.config.ts key settings
server: {
  port: 3000,
  open: true  // Auto-opens browser
}
build: {
  sourcemap: true  // Enables debugging
}
```

## Important Technical Details

### Theme Toggle Implementation
Uses Ant Design's theme algorithms:
```typescript
algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm
```

### Responsive Breakpoints
- 768px - Tablet layout adjustments
- 576px - Mobile layout adjustments

### Custom Scrollbar (Dark Theme)
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
```

### Ant Design Reset
Required in main.tsx: `import 'antd/dist/reset.css'`

## Admin Page Components

### Nomenclatures Page (`/admin/nomenclatures`)
- 4-tab interface: Materials | Works | Locations | Cost Categories
- Each tab has search, add/edit/delete actions
- Unit color coding for visual identification
- Mock data demonstrates expected functionality

### Tenders Page (`/admin/tenders`)
Complex table with:
- 12+ columns (number, name, client, dates, areas, currency rates, links)
- Search filters by name, number, client, version
- Date range picker for submission deadlines
- Row selection for bulk operations
- Dropdown actions: Edit, Duplicate, Archive, Export, Delete
- Empty state ready for backend data

### Construction Cost Page (`/admin/construction_cost`)
- Statistics cards: Planned Cost, Actual Cost, Deviation, Deviation %
- Location and category filtering
- Data table with deviation color coding (red/green)
- Summary row with totals
- Mock data with realistic calculations

## Unit Color System
Standardized colors for measurement units across the application:
```typescript
'шт' (pieces): 'blue'
'м' (meters): 'green'
'м2' (sq meters): 'cyan'
'м3' (cubic meters): 'purple'
'кг' (kilograms): 'orange'
'т' (tons): 'red'
'л' (liters): 'magenta'
'компл' (set): 'volcano'
'м.п.' (running meters): 'geekblue'
```