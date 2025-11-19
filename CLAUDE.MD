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
```

**Current Tables**:
- `tenders` - Main tender records with currency rates
- `material_names` - Material name library with units
- `work_names` - Work name library with units
- `materials_library` - Material records with pricing (without cost categories)
- `works_library` - Work records with pricing (without cost categories)
- `cost_categories` - Cost category definitions
- `detail_cost_categories` - Detailed cost items per location with location reference
- `units` - Unit of measurement reference table
- `templates` - Template container (name + cost category link)
- `template_items` - Universal table for works and materials with hierarchical structure (kind: 'work' | 'material')
- `client_positions` - Client position records for BOQ (hierarchical with parent_id)
- `boq_items` - Works and materials for each client position (linked to works_library/materials_library)
- `markup_parameters` - Markup calculation parameters
- `markup_tactics` - Markup strategies and rules
- `tender_markup_percentage` - Tender-specific markup percentages
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
- `/` and `/dashboard` - Tender dashboard with statistics and tender table (✅ complete)
- `/admin/nomenclatures` - Materials, Works, Locations, Cost Categories (✅ complete, Supabase integrated)
- `/admin/tenders` - Tender management table (✅ UI complete, Supabase ready)
- `/admin/construction_cost` - Cost calculation interface (✅ UI complete, mock data)
- `/admin/markup_constructor` - Markup calculation constructor (✅ complete, Supabase integrated)
- `/admin/markup` - Markup percentages management (✅ complete, Supabase integrated)
- `/library` - Materials/Works library with inline editing (✅ complete, Supabase integrated)
- `/library/templates` - Template management with works/materials (✅ complete, Supabase integrated)
- `/positions` - Client positions with hierarchical structure (✅ complete, Supabase integrated)
- `/positions/:positionId/items` - BOQ items management for each position (✅ complete, Supabase integrated)
- `/settings` - Application settings and configuration (✅ complete)
- `/commerce`, `/costs`, `/users` - Placeholder pages

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
- Current largest: MaterialsTab.tsx (~970 lines), WorksTab.tsx (~770 lines)
- **VIOLATION**: Library tabs need refactoring into smaller modules
- Split large files into modules with barrel exports

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

### Implemented (all migrations applied to prod.sql)
All database migrations have been executed and consolidated into `supabase/schemas/prod.sql`.

**Key migrations history:**
1. Tenders table with currency rates
2. Material/work name libraries and pricing tables
3. Locations and cost categories
4. Units reference table
5. BOQ item type enum consolidation
6. Template system (templates + template_items with universal structure)
7. Client positions (hierarchical with parent_id)
8. BOQ items (works/materials for positions)
9. Markup system (tactics, parameters, tender percentages)
10. Parent work item linking (soft delete with ON DELETE SET NULL)
11. RLS disabled for development (migration 014)

### Planned but Not Yet Implemented
- Authentication system with user roles (administrator, moderator, engineer, manager, director)
- Organizations and material categories
- Tender participants and collaboration features
- Audit log and comment system
- RLS policies (currently disabled for development)

### Key Database Patterns
- UUID primary keys with uuid_generate_v4()
- created_at/updated_at with automatic triggers
- RLS policies defined but currently disabled
- Foreign keys to auth.users for ownership

## Implementation Status

### Supabase Integration
- ✅ Client initialized in `src/lib/supabase.ts`
- ✅ TypeScript types defined for all database tables
- ✅ Environment variables configured (.env.local required)
- ❌ No authentication UI yet
- ❌ No RLS policies enabled

### UI Implementation Status
**Fully Implemented with Supabase:**
- `/dashboard` - Tender dashboard with tender statistics and management table
- `/admin/nomenclatures` - CRUD for Materials, Works, Locations, Cost Categories
- `/admin/markup_constructor` - Markup calculation constructor with tactics and parameters
- `/admin/markup` - Markup percentages management (base percentages and tender-specific)
- `/library` - Materials/Works library with inline editing, pagination, search
- `/library/templates` - Template management with hierarchical works/materials structure
- `/positions` - Client positions with hierarchical structure and inline editing
- `/positions/:positionId/items` - BOQ items (works/materials) for each position with instant add and inline editing
- `/settings` - Application settings (font configuration, etc.)

**UI Complete (Supabase Ready):**
- `/admin/tenders` - Complex tender management table with filters and actions
- `/admin/construction_cost` - Cost calculations with statistics and deviation analysis

**Placeholder Pages:**
- `/commerce` - Commercial calculations
- `/costs` - Construction costs
- `/users` - User management

## Next Development Steps

### Immediate Priorities
1. **Price Calculation System**
   - Implement price calculations for BOQ items
   - Apply markup percentages to positions
   - Calculate totals and subtotals
   - Currency conversion handling

2. **Refactor Large Components**
   - MaterialsTab.tsx (~970 lines) and WorksTab.tsx (~770 lines) exceed 600-line limit
   - Extract EditableCell components
   - Create separate form components
   - Use barrel exports

3. **Connect Remaining Pages to Supabase**
   - Tenders page CRUD operations
   - Construction Cost with real data
   - Add form validation throughout

4. **Build Authentication System**
   - Login/signup pages
   - User context provider
   - Protected route wrapper
   - Enable RLS policies

### Feature Development Priority
1. Implement price calculation engine for BOQ items
2. Add Excel import/export for positions and BOQ items
3. Build reporting and analytics features
4. Add tender comparison features
5. Implement collaboration tools (comments, notifications)

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

## Markup System Architecture

### Markup Constructor (`/admin/markup_constructor`)
**Complex markup calculation system with tactics and parameters**

**Three-Level Structure:**
1. **Markup Tactics** (`markup_tactics` table)
   - Named calculation strategies (e.g., "Схема 1", "Схема 2")
   - Each tactic contains multiple parameters
   - Can be copied/duplicated
   - Tender-specific or global

2. **Markup Parameters** (`markup_parameters` table)
   - Individual calculation rules within a tactic
   - Fields:
     - `order_number` - calculation sequence
     - `parameter_name` - display name
     - `base_value` - calculation base (options: "Материалы", "Работы", "Итого материалов + работ", etc.)
     - `coefficient` - multiplier for calculation
     - `is_percentage` - whether result is percentage
   - Supports complex calculation chains

3. **Tender Markup Percentages** (`tender_markup_percentage` table)
   - Links tactic to specific tender
   - Stores calculated base percentages per tender
   - Multiple percentages per tender (from different parameters)

**Key Features:**
- Drag-and-drop reordering of parameters
- Copy tactics functionality
- Tender-specific overrides
- Calculation order matters (sequential processing)

### Markup Percentages (`/admin/markup`)
**Base markup percentages management**
- Global base percentages (not tender-specific)
- Grid-based editing interface
- Used as foundation for tender-specific calculations

## Client Positions & BOQ Items Architecture

### Client Positions (`/positions`)
**Hierarchical position management for tenders**
- Self-referencing hierarchy with `parent_id` (supports unlimited nesting)
- Each position belongs to a tender (`tender_id`)
- Two volume fields:
  - `volume` - Volume from client
  - `manual_volume` - Manual volume (ГП - general contractor volume)
- Navigation: Click on leaf position name → opens `/positions/:positionId/items`
- Return navigation preserves context with URL params and highlights edited row
- Inline editing for manual_volume and manual_note

### BOQ Items (`/positions/:positionId/items`)
**Works and materials management for each client position**

**Instant Add Interface:**
- Two AutoComplete fields side-by-side (works | materials)
- Green + buttons for instant addition
- Auto-populates data from `works_library` and `materials_library`
- No intermediate forms - select and it's added immediately

**Works Auto-Population** (from `works_library`):
- `boq_item_type` (раб/суб-раб/раб-комп.)
- `unit_code` (unit of measurement)
- `currency_type`
- Default `quantity` = 1

**Materials Auto-Population** (from `materials_library`):
- `boq_item_type` (мат/суб-мат/мат-комп.)
- `material_type` (material classification)
- `unit_code`
- `consumption_coefficient` (К расх)
- `currency_type`
- `delivery_price_type`
- `delivery_amount`
- Default `quantity` = 1

**Inline Editing:**
- EditableCell component for editable columns
- Editable fields: `conversion_coefficient`, `quantity`, `parent_work_item_id`, `quote_link`
- Select dropdown for `parent_work_item_id` shows only works from current position
- Edit/Save/Cancel buttons per row

**Material-to-Work Linking:**
- `parent_work_item_id` - soft link to work (ON DELETE SET NULL)
- `conversion_coefficient` - material consumption per work unit
- Materials can be standalone or linked to specific works
- Same pattern as templates architecture

### Table Structure
- 13 columns: Тип, Наименование, К перв, К расх, Кол-во, Ед.изм., Цена, Доставка, Сумма, Привязка к работе, Категория затрат, Ссылка на КП, Примечание, Действия
- Color-coded item types (orange/purple/red for different types)
- Icon indication for linked materials (LinkOutlined)
- No pagination, vertical scroll only

## Templates Architecture

### Two-Table Structure
Migration 010 introduces a universal template system:
- `templates` - Container table (template metadata)
- `template_items` - Universal table for BOTH works AND materials

### Table: templates
Simple container with:
- `id` (uuid) - Template identifier
- `name` (text) - Template name
- `detail_cost_category_id` (uuid) - Link to detail_cost_categories (one per template)
- Timestamps (created_at, updated_at with auto-trigger)

### Table: template_items
Universal table using **discriminator column `kind`**:
- `kind` = `'work'` → row represents a work
- `kind` = `'material'` → row represents a material

### Key Fields
- `template_id` (uuid) - FK to templates (CASCADE DELETE)
- `kind` (text) - Discriminator: 'work' or 'material'
- `work_library_id` (uuid) - FK to works_library (only for kind='work')
- `material_library_id` (uuid) - FK to materials_library (only for kind='material')
- `parent_work_item_id` (uuid) - FK to template_items (only for materials linked to works)
- `conversation_coeff` (numeric(18,6)) - Conversion coefficient (only when material linked to work)
- `position` (integer) - Sort order within template
- `note` (text) - Optional notes

### Business Logic (CHECK Constraints)

**For works** (kind = 'work'):
```sql
work_library_id IS NOT NULL
material_library_id IS NULL
parent_work_item_id IS NULL
conversation_coeff IS NULL
```

**For materials** (kind = 'material'):
```sql
work_library_id IS NULL
material_library_id IS NOT NULL

AND one of:
a) Standalone material:
   parent_work_item_id IS NULL
   conversation_coeff IS NULL

b) Material linked to work:
   parent_work_item_id IS NOT NULL (references work row)
   conversation_coeff IS NOT NULL (consumption per work unit)
```

### Data Pattern Example
Template "Отделка офиса" with 2 works, 4 materials (3 linked, 1 standalone):

| id | kind | work_lib | mat_lib | parent | coeff | pos | Description |
|----|------|----------|---------|--------|-------|-----|-------------|
| 1  | work | W1       | NULL    | NULL   | NULL  | 1   | Work: Окраска |
| 2  | material | NULL | M1      | **1**  | **0.3** | 2 | Mat: Краска → Окраска |
| 3  | material | NULL | M2      | **1**  | **0.15** | 3 | Mat: Грунт → Окраска |
| 4  | work | W2       | NULL    | NULL   | NULL  | 4   | Work: Плинтус |
| 5  | material | NULL | M3      | **4**  | **1.05** | 5 | Mat: Плинтус → Плинтус |
| 6  | material | NULL | M4      | NULL   | NULL  | 6   | Mat: Standalone |

### Query Pattern
```typescript
// Fetch template with hierarchical structure
const { data } = await supabase
  .from('template_items')
  .select(`
    *,
    work_library:work_library_id(*, work_names(*)),
    material_library:material_library_id(*, material_names(*)),
    parent_work:parent_work_item_id(
      work_library:work_library_id(work_names(*))
    )
  `)
  .eq('template_id', templateId)
  .order('position');
```

### Advantages
- **Type-safe structure** - CHECK constraints enforce business rules at DB level
- **Hierarchical relationships** - materials can be linked to specific works via parent_work_item_id
- **Flexible** - supports both linked and standalone materials in same template
- **Foreign keys enforced** - CASCADE DELETE on template, RESTRICT on libraries, SET NULL on parent
- **Normalized** - template metadata separate from items
- **Single source** - works and materials in one table, no duplication