# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TenderHUB by SU_10 is a construction tender management portal for Bill of Quantities (BOQ) and bidding workflows. Currently in initial development with UI foundation complete and Supabase backend partially integrated.

**Language Convention**: Russian UI, English code, Russian commit messages
**Current State**: React + Ant Design UI shell with Supabase client configured
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

# Database operations
supabase start       # Start local Supabase instance
supabase stop        # Stop local Supabase instance
supabase db push     # Apply migrations to local database
supabase db reset    # Reset local database with fresh migrations
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
- `/admin/tenders` - Tender management table (✅ UI complete, integrating Supabase)
- `/admin/construction_cost` - Cost calculation interface (✅ UI complete, mock data)
- `/positions`, `/commerce`, `/library`, `/costs`, `/users`, `/settings` - Placeholder pages

### Supabase Configuration
- **Client**: `src/lib/supabase.ts` - Initialized with environment variables
- **Environment**: `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Types**: TypeScript interfaces defined for Tender table
- **Local Development**: Supabase Studio at http://localhost:54323

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

## Tech Stack

### Currently Installed (package.json)
```json
{
  "dependencies": {
    "@ant-design/icons": "^6.1.0",
    "@supabase/supabase-js": "^2.80.0",  // ✅ Backend client
    "antd": "^5.28.0",
    "dayjs": "^1.11.19",                  // Date manipulation
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.9.5"
  }
}
```

### NOT Yet Installed (but planned)
- @tanstack/react-query - Server state management
- react-hook-form + yup - Form validation
- xlsx-js-style - Excel export
- @dnd-kit/sortable - Drag and drop
- react-window - Virtual scrolling

**Important**: Always verify package.json before using any library

## Code Constraints

### File Size Rule
**STRICT**: All files MUST be ≤ 600 lines
- Current largest: Tenders.tsx (425 lines), ConstructionCost.tsx (400 lines)
- Split large files into modules with barrel exports

### TypeScript Configuration
- Target: ES2020, strict mode enabled
- No unused locals/parameters
- No implicit any (1 violation at MainLayout.tsx:88)
- React JSX transform (no React import needed)

### ESLint Rules
- Zero warnings enforced (`max-warnings: 0`)
- Current issues to fix:
  - MainLayout.tsx:88 - `any` type needs fixing (use `MenuClickEventHandler`)
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

## Database Architecture

### Migration Files (supabase/migrations/)
1. `001_create_tenders_table.sql` - Core tender entity with currency rates
2. `002_create_material_work_tables.sql` - Name libraries with units
3. `003_create_location_and_cost_categories_tables.sql` - Locations and cost categories

### Key Database Patterns
- UUID primary keys with `uuid_generate_v4()`
- `created_at`/`updated_at` with automatic triggers
- RLS policies defined but currently disabled
- Foreign keys to `auth.users` for ownership
- Indexes on frequently queried columns
- ON DELETE CASCADE for maintaining referential integrity

### Planned Tables (Not Yet Created)
- users (5 roles: administrator, moderator, engineer, manager, director)
- organizations, material_categories, materials, works
- boq_sections, boq_positions (hierarchical BOQ)
- tender_participants, audit_log, comments

## Component Implementation Status

### Fully Implemented Pages
1. **Dashboard** (`/dashboard`)
   - 8-card feature grid with gradients and hover effects
   - Responsive layout with Ant Design Grid
   - Icons and navigation to all modules

2. **Nomenclatures** (`/admin/nomenclatures`)
   - 4-tab interface: Materials | Works | Locations | Cost Categories
   - Search, add/edit/delete actions
   - Unit color coding for visual identification
   - Mock data demonstrates expected functionality

3. **Tenders** (`/admin/tenders`)
   - Complex table with 12+ columns
   - Search filters by name, number, client, version
   - Date range picker for submission deadlines
   - Row selection for bulk operations
   - Dropdown actions: Edit, Duplicate, Archive, Export, Delete
   - Modal for create/edit operations
   - Integrating with Supabase for real data

4. **Construction Cost** (`/admin/construction_cost`)
   - Statistics cards: Planned Cost, Actual Cost, Deviation, Deviation %
   - Location and category filtering
   - Data table with deviation color coding (red/green)
   - Summary row with totals
   - Mock data with realistic calculations

### Placeholder Pages
- `/positions` - BOQ management
- `/commerce` - Commercial calculations
- `/library` - Materials/works catalog
- `/costs` - Construction costs
- `/users` - User management
- `/settings` - System configuration

## Immediate Development Tasks

### TypeScript Fixes
1. Fix `any` type at MainLayout.tsx:88:
   ```typescript
   import type { MenuClickEventHandler } from 'antd/es/menu/interface';
   const handleMenuClick: MenuClickEventHandler = (e) => navigate(e.key);
   ```

2. Fix ESLint warning in ThemeContext.tsx (extract hook to separate file)

### Next Features to Implement
1. Complete Supabase integration for all admin pages
2. Implement authentication with Supabase Auth
3. Build `/positions` page for BOQ management
4. Add form validation with react-hook-form
5. Implement data export functionality
6. Add real-time updates with Supabase subscriptions

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

### Theme Implementation
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

### Unit Color System
Standardized colors for measurement units:
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

## Testing Commands

Currently no test setup. When implementing tests:
```bash
# Future test commands (not yet configured)
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

## Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=https://vswxtmkdsimwgmvzysdo.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Access in code:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```