# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TenderHUB by SU_10 is a construction tender management portal for Bill of Quantities (BOQ) and bidding workflows. Active development with full-stack architecture operational.

**Language Convention**: Russian UI, English code, Russian commit messages
**Current State**: React + Ant Design + Supabase full-stack app with authentication, role-based access, and comprehensive feature set
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

# Database
supabase db push     # Apply migrations to local database
supabase db reset    # Reset local database (destructive)
supabase migration new <name>  # Create new migration file

# Environment setup
# Create .env.local with:
# VITE_SUPABASE_URL=your_project_url
# VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
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

**Core Tables** (see `supabase/schemas/prod.sql` and recent migrations):
- `users` - User accounts with role_code, access_status, allowed_pages
- `tenders` - Main tender records with currency rates, housing_class, construction_scope
- `material_names`, `work_names` - Name libraries with units
- `materials_library`, `works_library` - Full material/work definitions
- `locations` - Construction site locations
- `cost_categories`, `detail_cost_categories` - Cost structure
- `boq_sections`, `boq_items` - Bill of Quantities hierarchy
- `client_positions`, `position_items` - Client requirements and item details
- `tasks` - Task management system
- `markup_tactics`, `markup_sequences` - Pricing strategies
- `audit_log` - Comprehensive audit trail for all changes
- ENUMs: `unit_type`, `material_type`, `boq_item_type`, `currency_type`, `housing_class_type`, `construction_scope_type`, `access_status_type`

## Architecture & Patterns

### Component Hierarchy
```
App.tsx
└── ThemeProvider (context, localStorage persistence)
    └── AuthProvider (context, Supabase auth + user data)
        └── ConfigProvider (Ant Design theming)
            └── AntApp (Ant Design message/notification context)
                └── Routes
                    ├── Public Routes: /login, /register, /forgot-password, /reset-password
                    └── ProtectedRoute (guards authenticated routes)
                        └── MainLayout
                            ├── Sider (collapsible navigation, role-based menu items)
                            ├── Header (search, theme toggle, user menu, notifications)
                            └── Content (nested routing via Outlet)
```

### Implemented Routes
**Fully Functional:**
- `/dashboard` - 8-card feature grid with role-based visibility
- `/tasks` - Task management with assignees, deadlines, status tracking
- `/positions` - Client positions (BOQ management)
- `/positions/:positionId/items` - Detailed BOQ items with materials/works
- `/commerce/proposal` - Commercial proposal generation
- `/commerce/redistribution` - Cost redistribution workflow
- `/library` - Materials & Works library with templates
- `/library/templates` - Template management for BOQ items
- `/bsm` - Construction cost management (БСМ)
- `/analytics/comparison` - Object comparison analytics
- `/costs` - Construction cost calculations
- `/financial-indicators` - Financial metrics and charts
- `/projects` - Project list
- `/projects/:projectId` - Project details
- `/users` - User management (admin only)

**Admin Routes:**
- `/admin/nomenclatures` - Material names, work names, units, locations
- `/admin/tenders` - Tender CRUD with Excel import, version matching
- `/admin/construction_cost` - Cost categories and details
- `/admin/markup_constructor` - Markup tactics and sequences
- `/admin/markup` - Markup percentages configuration

### Authentication & Access Control
- **Context**: `src/contexts/AuthContext.tsx`
- **Client**: `src/lib/supabase/client.ts` (configured with env vars)
- **User Roles**: 5 roles defined in `users.role_code`
  - `administrator` - Full system access
  - `moderator` - Content moderation
  - `engineer` - Technical access
  - `manager` - Management views
  - `director` - Executive dashboards
- **Access Status**: `pending`, `approved`, `rejected` (controls login)
- **Page-Level Access**: `users.allowed_pages` (JSONB array) controls menu visibility
- **Protected Routes**: All routes wrapped in `ProtectedRoute` component
- **Auth Flow**: Email/password with Supabase Auth, linked to `public.users` table

### Theme System
- **Context**: `src/contexts/ThemeContext.tsx`
- **Storage**: localStorage key `tenderHub_theme`
- **Colors**: Primary `#10b981` (emerald), Success `#159957`, Info `#0891b2`
- **Dark**: Black background (`#000`), sidebar `#0a0a0a`
- **Light**: Ant Design defaults
- **Toggle**: Header icon switches between light/dark with algorithm switch

### Custom Components
**Icons** (`src/components/Icons/`):
- `LogoIcon` - Building + crane design (sidebar)
- `HeaderIcon` - Modern house design (dashboard header)

**Auth** (`src/components/Auth/`):
- `ProtectedRoute` - Route guard checking authentication status

**Layout** (`src/components/Layout/`):
- `MainLayout` - Main app shell with responsive sidebar, header, content area

## Tech Stack Reality Check

### Currently Installed
**Core:**
- `react@18.3.1`, `react-dom@18.3.1` - UI library
- `react-router-dom@7.9.5` - Routing
- `@supabase/supabase-js@2.80.0` - Backend client
- `antd@5.28.0` - UI component library
- `@ant-design/icons@6.1.0` - Icon library
- `@ant-design/charts@2.6.7` - Chart components
- `dayjs@1.11.19` - Date manipulation

**Data Visualization:**
- `chart.js@4.5.1`, `react-chartjs-2@5.3.1` - Charts
- `chartjs-plugin-datalabels@2.2.0` - Chart labels

**File Processing:**
- `xlsx@0.18.5` - Excel reading
- `xlsx-js-style@1.2.0` - Excel writing with styling

**Dev Tools:**
- `typescript@5.2.2`, `vite@5.3.1`
- `eslint@8.57.0` with React plugins

**NOT Yet Installed:**
- @tanstack/react-query (planned for server state)
- react-hook-form + yup (planned for forms)
- @dnd-kit/sortable (planned for drag-drop)

## Code Constraints

### File Size Rule
**STRICT**: All files MUST be ≤ 600 lines
- Split large files into:
  - Components folder with index.tsx barrel export
  - Hooks folder for custom hooks
  - Utils folder for helper functions
  - Types file for interfaces/types

### TypeScript Configuration
- Target: ES2020, strict mode enabled
- No unused locals/parameters
- No implicit any
- React JSX transform (no React import needed)
- Types centralized in `src/lib/supabase/types.ts`

### ESLint Rules
- Zero warnings enforced (`max-warnings: 0`)
- Must pass before commits

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

## Data Access Patterns

### Supabase Client Usage
```typescript
// Import from centralized client
import { supabase } from '@/lib/supabase';

// Standard CRUD operations
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);

// With TypeScript types
import type { Tender, TenderInsert } from '@/lib/supabase/types';
const { data } = await supabase
  .from('tenders')
  .select('*')
  .returns<Tender[]>();
```

### Audit Logging
- **Automatic**: All table changes logged via `src/lib/supabaseWithAudit.ts`
- **Manual calls**: Use `logAudit()` helper for critical actions
- **Table**: `audit_log` stores user_id, table_name, action, old_value, new_value
- **Viewing**: Available in admin UI and audit history tabs

### Key Database Patterns
- UUID primary keys with uuid_generate_v4()
- created_at/updated_at with automatic triggers
- created_by foreign keys to auth.users.id
- RLS policies enforce row-level security (check prod.sql for policies)
- Migrations in `supabase/migrations/` (numbered sequentially)

## Key Features & Patterns

### Excel Import/Export
- **Import**: `xlsx` library reads .xlsx files, maps columns to database fields
- **Export**: `xlsx-js-style` writes formatted Excel with styling
- **Locations**:
  - Tenders page: Import BOQ from Excel with column mapping UI
  - Nomenclatures: Import material/work names in bulk
  - Library: Export materials/works for offline editing

### BOQ (Bill of Quantities) Management
- **Hierarchy**: Tenders → Client Positions → BOQ Sections → BOQ Items
- **Item Types**: Material (`мат`, `суб-мат`, `мат-комп.`) and Work (`раб`, `суб-раб`, `раб-комп.`)
- **Templates**: Reusable groups of materials/works saved in library
- **Versioning**: Tenders support multiple versions with diff comparison

### Cost Calculation System
- **Construction Cost**: Detailed cost categories per location
- **Markup Constructor**: Define markup tactics (sequences of percentages)
- **Cost Redistribution**: Complex workflow to move costs between categories
- **Financial Indicators**: Charts showing cost breakdown, profit margins

### Task Management
- **Assignment**: Tasks linked to users, client_positions, tenders
- **Tracking**: Status, priority, deadlines, completion percentage
- **Views**: List view and per-employee kanban view

## Important Technical Details

### State Management
- **Contexts**: Theme, Auth (no Redux/Zustand yet)
- **Local State**: useState for component-level state
- **Server State**: Direct Supabase calls (no React Query yet)
- **Forms**: Ant Design Form components (no react-hook-form yet)

### File Organization
Pages follow this structure:
```
src/pages/PageName/
├── PageName.tsx          # Main component
├── components/           # Page-specific components
│   ├── SubComponent.tsx
│   └── index.ts         # Barrel export
├── hooks/               # Custom hooks
│   └── usePageLogic.tsx
├── utils/               # Helper functions
└── types.ts            # Page-specific types
```

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
- **Desktop**: > 992px (full sidebar, all columns visible)
- **Tablet**: 768-992px (collapsible sidebar, some columns hidden)
- **Mobile**: < 768px (sidebar as drawer, minimal columns)
- Ant Design Grid: xs={24} sm={12} md={8} lg={6} xl={4}

### Custom Scrollbar (Dark Theme)
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
```

### Ant Design Integration
- Import reset: `import 'antd/dist/reset.css'` in main.tsx
- ConfigProvider wraps app for theme configuration
- AntApp wrapper provides message/notification context
- Form.Item pattern for form fields with validation
- Table component with pagination, sorting, filtering

## Common Workflows

### Adding a New Page
1. Create folder: `src/pages/PageName/`
2. Create `PageName.tsx` with main component
3. Add route in `src/App.tsx` under appropriate section
4. Update `MainLayout` menu if needed (with role check)
5. Add types to `src/lib/supabase/types.ts` if using new tables
6. Follow 600-line limit - split into components/ and hooks/ as needed

### Creating a New Database Table
1. Create migration: `supabase migration new table_name`
2. Write SQL in `supabase/migrations/XXX_table_name.sql`:
   - UUID primary key with uuid_generate_v4()
   - created_at, updated_at timestamps
   - created_by foreign key to auth.users
   - RLS policies
3. Run: `supabase db push`
4. Add TypeScript types to `src/lib/supabase/types.ts`
5. Update `supabase/schemas/prod.sql` after pushing

### Adding Authentication to a Page
1. Wrap route in `<ProtectedRoute>` in App.tsx (already done for all routes)
2. Access user via `useAuth()` hook from AuthContext
3. Check role: `if (user?.role_code === 'administrator')`
4. Check page access: `user?.allowed_pages?.includes('page_key')`

## Unit Color System
Standardized Ant Design tag colors for measurement units:
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
Implemented in multiple components for consistency.