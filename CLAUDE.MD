
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

# Database (Supabase CLI required)
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

ROW LEVEL SECURITY (RLS):
- RLS MUST BE DISABLED by default in all new tables
- DO NOT add "ALTER TABLE ... ENABLE ROW LEVEL SECURITY"
- DO NOT create RLS policies in migrations
- Authentication and authorization will be handled at application level
- RLS for markup_tactics was DISABLED (migration: disable_markup_tactics_rls.sql)
```

**Current Tables**:
- `tenders` - Main tender records with currency rates
- `tender_markup_percentage` - Tender markup percentages and commercial calculations
- `markup_tactics` - Markup calculation tactics/sequences (localStorage + Supabase)
- `material_names` - Material name library with units
- `work_names` - Work name library with units
- `materials_library` - Material records with pricing
- `works_library` - Work records with pricing
- `locations` - Construction site locations
- `cost_categories` - Cost category definitions
- `detail_cost_categories` - Detailed cost items per location with location reference
- `units` - Unit of measurement reference table
- ENUM: `boq_item_type` ('мат', 'суб-мат', 'мат-комп.', 'раб', 'суб-раб', 'раб-комп.')

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
- `/admin/nomenclatures` - Materials, Works, Locations, Cost Categories (✅ complete, Supabase integrated)
- `/admin/tenders` - Tender management table (✅ UI complete, Supabase ready)
- `/admin/construction_cost` - Cost calculation interface (✅ UI complete, mock data)
- `/admin/markup-constructor` - Markup calculation tactics builder (✅ complete, localStorage + Supabase)
- `/library` - Materials/Works library with inline editing (✅ complete, Supabase integrated)
- `/positions`, `/commerce`, `/costs`, `/users`, `/settings` - Placeholder pages

### Theme System
- **Context**: `src/contexts/ThemeContext.tsx`
- **Storage**: localStorage key `tenderHub_theme`
- **Colors**: Primary `#10b981` (emerald)
- **Dark**: Black background (`#000`), sidebar `#0a0a0a`
- **Light**: Ant Design defaults

### localStorage Keys
- `tenderHub_theme` - Theme preference (light/dark)
- `markupSequences` - Markup calculation sequences (per item type)
- `markupBaseCosts` - Base costs for markup calculations
- `markupSequencesVersion` - Version tracking ('v2')

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
    "@supabase/supabase-js": "^2.80.0",
    "antd": "^5.28.0",
    "dayjs": "^1.11.19",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.9.5",
    "xlsx": "^0.18.5"
  }
}
```

### NOT Yet Installed (but planned)
- @tanstack/react-query
- react-hook-form + yup
- xlsx-js-style (currently using basic xlsx)
- @dnd-kit/sortable
- react-window

**Important**: Verify package.json before using any library

## Code Constraints

### File Size Rule
**STRICT**: All files MUST be ≤ 600 lines
- Current violations:
  - MarkupConstructor.tsx (~1790 lines) - Complex state management for multi-step calculations
  - MaterialsTab.tsx (~970 lines) - Library inline editing
  - WorksTab.tsx (~770 lines) - Library inline editing
- **TODO**: Refactor into smaller modules with barrel exports
- Split candidates: EditableCell, form components, calculation logic

### TypeScript Configuration
- Target: ES2020, strict mode
- No unused locals/parameters
- No implicit any
- React JSX transform (no React import needed)

### ESLint Rules
- Zero warnings enforced (`max-warnings: 0`)
- Clean build currently maintained

### Git Conventions
- **🚨 ВАЖНО**: Коммиты создаются ТОЛЬКО по явному запросу пользователя
- Всегда дождаться команды "коммить", "создай коммит" или аналогичной перед выполнением git commit
- Никогда не делать автоматические коммиты после завершения задачи
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

### Schema Management
- **Source of Truth**: `supabase/schemas/prod.sql` - Complete database schema with all Supabase system tables
- **Migration Files**: Consolidated into `supabase/migrations/prod.sql`
- **Latest Migration**: `20251113_create_markup_tactics_table.sql` - Markup tactics with RLS enabled (exception to RLS rule)

### Current Tables (as defined in prod.sql)
1. `tenders` - Core tender entity with currency rates
2. `tender_markup_percentage` - Tender markup percentages and commercial calculations
3. `markup_tactics` - User-specific markup calculation tactics (RLS enabled, user_id based)
4. `material_names` - Material name library with units
5. `work_names` - Work name library with units
6. `materials_library` - Material records with pricing
7. `works_library` - Work records with pricing
8. `locations` - Construction site locations
9. `cost_categories` - Cost category definitions
10. `detail_cost_categories` - Detailed cost items per location
11. `units` - Unit of measurement reference table
12. ENUM: `boq_item_type` - Unified item types ('мат', 'суб-мат', 'мат-комп.', 'раб', 'суб-раб', 'раб-комп.')

### Planned but Not Created
- users (5 roles: administrator, moderator, engineer, manager, director)
- organizations, material_categories
- boq_sections, boq_positions (hierarchical BOQ)
- tender_participants, audit_log, comments

### Key Database Patterns
- UUID primary keys with uuid_generate_v4()
- created_at/updated_at with automatic triggers
- **RLS DISABLED** - Authorization handled at application level
- Foreign keys with ON DELETE CASCADE where appropriate

## Implementation Status

### Supabase Integration
- ✅ Client initialized in `src/lib/supabase.ts`
- ✅ TypeScript types defined for all database tables
- ✅ Environment variables configured (.env.local required)
- ✅ RLS disabled - authorization at application level
- ❌ No authentication UI yet

### UI Implementation Status
**Fully Implemented with Supabase:**
- `/dashboard` - 8-card feature grid with gradients and hover effects
- `/admin/nomenclatures` - CRUD for Materials, Works, Locations, Cost Categories
- `/admin/markup-constructor` - Markup calculation tactics builder with localStorage auto-save
- `/library` - Materials/Works library with inline editing, pagination, search

**UI Complete (Supabase Ready):**
- `/admin/tenders` - Complex tender management table with filters and actions
- `/admin/construction_cost` - Cost calculations with statistics and deviation analysis

**Placeholder Pages:**
- `/positions` - BOQ management
- `/commerce` - Commercial calculations
- `/costs` - Construction costs
- `/users` - User management
- `/settings` - System configuration

## Next Development Steps

### Immediate Priorities
1. **Refactor Library components** - MaterialsTab.tsx and WorksTab.tsx exceed 600-line limit
   - Extract EditableCell components
   - Create separate form components
   - Use barrel exports

2. **Connect Tenders page to Supabase**
   - Implement CRUD operations
   - Add form validation
   - Handle currency rate updates

3. **Build Authentication**
   - Login/signup pages
   - User context provider
   - Protected route wrapper

### Feature Development Priority
1. Build `/positions` page (BOQ CRUD with hierarchical structure)
2. Connect `/admin/construction_cost` to real data
3. Add react-hook-form for complex forms
4. Implement TanStack Query for server state management
5. Add Excel export functionality using xlsx library

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

## Key Page Components

### Nomenclatures Page (`/admin/nomenclatures`)
**Fully functional with Supabase**
- 4-tab interface: Materials | Works | Locations | Cost Categories
- CRUD operations with real-time data
- Inline editing with form validation
- Unit color coding for visual identification
- Duplicate name detection

### Library Page (`/library`)
**Fully functional with Supabase**
- 2-tab interface: Materials | Works
- Inline table editing with color-coded row types:
  - Materials: мат (orange), суб-мат (purple), мат-комп. (red)
  - Works: раб (orange), суб-раб (purple), раб-комп. (red)
- Unified search in Card header
- Pagination: 100/250/500/1000 rows
- Parent-child component communication via useImperativeHandle
- AutoComplete for names and cost categories
- Dynamic form border colors based on item type

### Tenders Page (`/admin/tenders`)
**UI complete, needs Supabase connection**
- 12+ columns (number, name, client, dates, areas, currency rates, links)
- Search filters by name, number, client, version
- Date range picker for submission deadlines
- Row selection for bulk operations
- Dropdown actions: Edit, Duplicate, Archive, Export, Delete
- Modal form for add/edit operations

### Construction Cost Page (`/admin/construction_cost`)
**UI complete with mock data**
- Statistics cards: Planned Cost, Actual Cost, Deviation, Deviation %
- Location and category filtering
- Data table with deviation color coding (red/green)
- Summary row with totals

### Markup Constructor Page (`/admin/markup-constructor`)
**Fully functional with dual storage**
- 2-tab interface: "Проценты наценок" | "Порядок применения наценок"
- **Percentages Tab**: 14 markup percentage inputs linked to tender_markup_percentage table
- **Tactics Tab**: 6 sub-tabs (works, materials, subcontract_works, subcontract_materials, work_comp, material_comp)
- **Complex State Management**: ~1790 lines handling multi-step markup calculation sequences
- **Data Flow**:
  - Markup percentages: Supabase (tender_markup_percentage table)
  - Markup sequences/tactics: localStorage auto-save (key: 'markupSequences', 'markupBaseCosts')
  - Future: Will sync tactics to markup_tactics table with user_id
- **Calculation Engine**:
  - Base cost input per item type
  - Up to 5 chained operations per step (multiply/divide/add/subtract)
  - Operands can be markup percentages or previous step results
  - Real-time intermediate result calculation and display
  - Visual formula rendering with step-by-step breakdown
- **Important Pattern**: Uses `isDataLoaded` flag to prevent auto-save during initial mount

## Library Page Architecture Patterns

### Parent-Child Communication
The Library index component uses refs to trigger actions in child tabs:
```typescript
// Parent (index.tsx)
const materialsTabRef = useRef<any>(null);
materialsTabRef.current.handleAdd();

// Child (MaterialsTab.tsx)
useImperativeHandle(ref, () => ({
  handleAdd: () => { /* open add form */ }
}));
```

### Inline Editing Pattern
Both MaterialsTab and WorksTab use Ant Design's editable table pattern:
1. Each row has `isEditing()` check
2. EditableCell component switches between display/input
3. Form fields wrap inputs for validation
4. Border colors change based on `item_type` during editing

### Data Flow
1. Fetch data with Supabase joins (e.g., `material_names`, `detail_cost_categories`)
2. Transform to flat structure with computed fields (e.g., `material_name`, `unit`)
3. Filter by search text from parent
4. Render with pagination

### AutoComplete Integration
Cost categories use nested AutoComplete:
- Format: `"Category / Detail / Location"`
- Store mapping of display strings to IDs
- Handle selection by finding matching ID

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

## Item Type Color System
Color coding for material/work types in Library:
```typescript
// Materials
'мат': '#ff9800' (orange)
'суб-мат': '#9c27b0' (purple)
'мат-комп.': '#f44336' (red)

// Works
'раб': '#ff9800' (orange)
'суб-раб': '#9c27b0' (purple)
'раб-комп.': '#f44336' (red)
```
Applied to:
- Row background colors (15% opacity, 25% on hover)
- Form border colors during inline editing
- Add form border color (dynamic)