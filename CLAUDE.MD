# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TenderHUB by SU_10 is a construction tender management portal for Bill of Quantities (BOQ) and bidding workflows. Currently in active development with complete UI and Supabase integration for core features.

**Language Convention**: Russian UI, English code, Russian commit messages
**Current State**: React + Ant Design UI with Supabase backend integrated
**Organization**: SU-10 (Construction Company)
**Branding**: Complete design system documented in BRANDING.md
**Logo Preview**: http://localhost:3000/logo-preview.html

## Environment Setup

**Required**: Create `.env.local` file with Supabase credentials:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_APP_NAME=TenderHub
VITE_APP_VERSION=1.0.0
NODE_ENV=development
```

See `.env.local` template in repository for full configuration.

## Development Commands

```bash
# Core development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000, auto-opens)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build
npm run lint         # ESLint with zero-warning enforcement

# Testing
npx playwright test  # Run Playwright E2E tests
npx playwright test --ui  # Open Playwright UI
npx playwright test tests/test-current-tactic.spec.ts  # Run specific test

# Database (Supabase CLI required)
supabase db push     # Apply migrations
supabase db reset    # Reset local database

# Utility scripts (Node.js scripts for debugging/maintenance)
# Located in /scripts/ directory
node scripts/recalculate-boq-items.js        # Recalculate BOQ item prices
node scripts/list-tenders.js                 # List all tenders
node scripts/show-tactic-details.js          # Show markup tactic details
node scripts/setup-markup-parameters.js      # Setup markup parameters
node scripts/list-all-tactics.js             # List all markup tactics
node scripts/generate-ai-context.cjs         # Generate AI-friendly DB schema exports

# AI Context Generation
# Creates optimized schema extracts for AI assistants (Claude Code, Copilot)
node scripts/generate-ai-context.cjs
# Output: supabase/ai_context/ directory with:
# - ai_manifest.json (metadata + SHA256 hashes)
# - ai_tables_min.json (compact table schemas)
# - ai_relations.json (FK relationships graph)
# - ai_functions_min.json (function signatures)
# - ai_triggers_min.json (trigger mappings)
# - ai_enums_min.json (enum definitions)
# - ai_tables_full.json (full schemas with indexes)
# - ai_functions_full.json (functions with side effects)
# - ai_examples.sql (sample queries)
```

## 🚨 CRITICAL DATABASE RULES 🚨

```
DATABASE SINGLE SOURCE OF TRUTH:
supabase/schemas/prod.sql

- ALWAYS verify schema in prod.sql before ANY database work
- NEVER trust TypeScript types over prod.sql definitions
- prod.sql contains ALL Supabase system tables and extensions
- Business tables defined in migrations (001-014+)

MIGRATION WORKFLOW:
- ALL database migrations MUST be created in supabase/migrations/ directory
- Use sequential numbering: 001_, 002_, 003_, etc.
- NEVER create SQL files in scripts/ directory for migrations
- NEVER apply migrations automatically or update prod.sql directly
- ALWAYS provide SQL code to user for manual execution in Supabase SQL Editor
- User will manually run SQL and update prod.sql when needed
- After migration execution, may need to run: NOTIFY pgrst, 'reload schema';
```

**Current Tables**:
- `tenders` - Main tender records with currency rates
- `material_names` - Material name library with units
- `work_names` - Work name library with units
- `materials_library` - Material records with pricing and calculations
- `works_library` - Work records with pricing and calculations
- `cost_categories` - Cost category definitions
- `detail_cost_categories` - Detailed cost items per location with location reference
- `units` - Unit of measurement reference table
- `templates` - Template container (name + cost category link)
- `template_items` - Universal table for works and materials with hierarchical structure (kind: 'work' | 'material')
- `client_positions` - Client position records for BOQ (hierarchical with parent_id)
- `boq_items` - Works and materials for each client position with calculated prices
- `markup_parameters` - Markup calculation parameters with ordered execution
- `markup_tactics` - Markup strategies and rules
- `tender_markup_percentage` - Tender-specific markup percentages
- `subcontract_growth_exclusions` - Exclusions from subcontract growth markup (separate for works and materials)
- `notifications` - User notifications system (managed via scripts)
- ENUM: `boq_item_type` ('мат', 'суб-мат', 'мат-комп.', 'раб', 'суб-раб', 'раб-комп.')

## 🤖 AI Context for Database Schema

### What is AI Context?
The `supabase/ai_context/` directory contains optimized database schema extracts specifically designed for AI assistants (Claude Code, GitHub Copilot, etc.). These files provide a compact, AI-friendly representation of the entire database structure.

### Generated Files (Total: ~130 KB)
Located in `supabase/ai_context/`:

**Minimal Schemas** (for quick reference):
- `ai_tables_min.json` (37 KB) - Table structures with columns, types, and foreign keys
- `ai_relations.json` (7 KB) - Foreign key relationship graph between tables
- `ai_functions_min.json` (3.6 KB) - Function signatures with brief descriptions
- `ai_triggers_min.json` (3.6 KB) - Trigger → Function → Event mappings
- `ai_enums_min.json` (1 KB) - Enum types and their allowed values

**Full Schemas** (for detailed analysis):
- `ai_tables_full.json` (62 KB) - Complete schemas with indexes, CHECK, and UNIQUE constraints
- `ai_functions_full.json` (5.3 KB) - Functions with side effects and affected tables

**Examples & Metadata**:
- `ai_examples.sql` (8.8 KB) - 12 reference SQL queries demonstrating correct usage
- `ai_manifest.json` (0.6 KB) - Generation metadata with SHA256 hashes of source files

### When to Regenerate
Run `node scripts/generate-ai-context.cjs` after:
- Database migrations
- Schema changes in `prod.sql`
- Updates to triggers or functions
- Changes in `supabase/exports/` files

The manifest tracks SHA256 hashes to detect when source files have changed.

### How to Use
These files are automatically available to Claude Code when working in this repository. You can reference them directly:

```
"Using ai_tables_min.json and ai_relations.json, write a query to get all BOQ items
with commercial prices for tender X, including material and work breakdowns"
```

Claude Code will use these compact schemas instead of scanning the full `prod.sql` file (185 KB), saving context tokens and improving response accuracy.

### Key Benefits
- **Compact**: 37 KB vs 185 KB for minimal table schema
- **Structured**: JSON format for easy parsing
- **Comprehensive**: Covers tables, functions, triggers, enums, and relationships
- **Examples**: Real SQL queries demonstrating best practices
- **Versioned**: SHA256 hashes track source file changes

See `supabase/ai_context/README.md` for detailed documentation.

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
- `/admin/construction_cost` - Справочник затрат (Cost reference catalog with CRUD operations) (✅ complete, Supabase integrated)
- `/admin/markup_constructor` - Markup calculation constructor (✅ complete, Supabase integrated)
- `/admin/markup` - Markup percentages management (✅ complete, Supabase integrated)
- `/library` - Materials/Works library with inline editing (✅ complete, Supabase integrated)
- `/library/templates` - Template management with works/materials (✅ complete, Supabase integrated)
- `/positions` - Client positions with hierarchical structure (✅ complete, Supabase integrated)
- `/positions/:positionId/items` - BOQ items management for each position (✅ complete with price calculations)
- `/commerce` - Commercial calculations with BOQ analysis (✅ complete with calculations)
- `/costs` - Затраты на строительство (Construction costs analysis by tender) (✅ complete with calculations and pricing distribution)
- `/bsm` - BSM (Building Systems Model) page (✅ complete)
- `/analytics/comparison` - Object comparison analytics (✅ complete)
- `/financial-indicators` - Financial indicators with Chart.js visualizations (✅ complete)
- `/settings` - Application settings and configuration (✅ complete)
- `/users` - Placeholder page

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
    "@supabase/supabase-js": "^2.80.0",
    "antd": "^5.28.0",
    "chart.js": "^4.5.1",
    "chartjs-plugin-datalabels": "^2.2.0",
    "dayjs": "^1.11.19",
    "react": "^18.3.1",
    "react-chartjs-2": "^5.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.9.5",
    "xlsx": "^0.18.5",
    "xlsx-js-style": "^1.2.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.1",
    "playwright": "^1.56.1"
  }
}
```

### Testing Infrastructure
- **Framework**: Playwright for E2E testing
- **Config**: `playwright.config.ts` with Chromium project
- **Test Location**: `./tests/` directory
- **Base URL**: http://localhost:3001 (for tests, different from dev port)
- **Test Files**: Commerce flow tests, markup calculation verification tests

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

## Price Calculation System

### BOQ Items Price Calculation
The system implements a complex multi-stage price calculation for BOQ items:

1. **Base Price Application**:
   - Materials: Apply `material_price` from `materials_library`
   - Works: Apply `work_price` from `works_library`

2. **Markup Application**:
   - Retrieve tender's markup tactic from `markup_tactics`
   - Apply parameters in order from `markup_parameters`
   - Each parameter applies coefficient to specified base (materials/works/total)
   - Results stored in `calculated_price` field

3. **Material Growth Calculation**:
   - Special handling for materials with growth coefficients
   - Applied after base markup calculations
   - Affects final material pricing

### Calculation Scripts
Utility scripts in `/scripts/` for debugging and maintenance (~30+ scripts available):
- `recalculate-boq-items.js` - Recalculate all BOQ item prices
- `check-tender-params.js` - Verify tender markup parameters
- `check-commercial-costs.js` - Verify commercial cost calculations
- `debug-position-calculation.js` - Debug position-level calculations
- `test-material-growth.js` - Test material growth coefficients
- `check-admiral-tactic.js` - Check specific tactic details
- `simulate-mat-calculation.js` - Simulate material calculations
- And many more in `/scripts/` directory

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
11. Calculated price fields for BOQ items
12. Material growth coefficients
13. Commercial calculation fields
14. RLS disabled for development (migration 014)

### Key Database Patterns
- UUID primary keys with uuid_generate_v4()
- created_at/updated_at with automatic triggers
- RLS policies defined but currently disabled
- Foreign keys to auth.users for ownership
- Calculated fields updated via triggers or application logic

## Implementation Status

### Supabase Integration
- ✅ Client initialized in `src/lib/supabase.ts`
- ✅ TypeScript types defined for all database tables
- ✅ Environment variables configured (.env.local required)
- ✅ Price calculation system integrated
- ❌ No authentication UI yet
- ❌ No RLS policies enabled

### UI Implementation Status
**Fully Implemented with Supabase:**
- `/dashboard` - Tender dashboard with tender statistics and management table
- `/admin/nomenclatures` - CRUD for Materials, Works, Locations, Cost Categories
- `/admin/markup_constructor` - Markup calculation constructor with tactics and parameters
- `/admin/markup` - Markup percentages management (base percentages and tender-specific)
- `/admin/construction_cost` - Cost reference catalog management
- `/library` - Materials/Works library with inline editing, pagination, search
- `/library/templates` - Template management with hierarchical works/materials structure
- `/positions` - Client positions with hierarchical structure and inline editing
- `/positions/:positionId/items` - BOQ items with calculated prices and instant add
- `/commerce` - Commercial calculations with position analysis and profit tracking
- `/costs` - Construction costs analysis with tender-specific calculations
- `/bsm` - Building Systems Model page
- `/analytics/comparison` - Object comparison analytics
- `/financial-indicators` - Financial indicators with Chart.js visualizations
- `/settings` - Application settings (font configuration, etc.)

**UI Complete (Supabase Ready):**
- `/admin/tenders` - Complex tender management table with filters and actions

**Placeholder Pages:**
- `/users` - User management

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

## Markup System Architecture

### Markup Constructor (`/admin/markup_constructor`)
**Complex markup calculation system with tactics and parameters**

**Three-Level Structure:**
1. **Markup Tactics** (`markup_tactics` table)
   - Named calculation strategies (e.g., "Базовая схема наценок", "Тестовая схема ×10")
   - Each tactic contains multiple parameters
   - Can be copied/duplicated
   - Tender-specific or global

2. **Markup Parameters** (`markup_parameters` table)
   - Individual calculation rules within a tactic
   - Fields:
     - `order_number` - calculation sequence (critical for calculation order)
     - `parameter_name` - display name
     - `base_value` - calculation base (options: "Материалы", "Работы", "Итого материалов + работ", etc.)
     - `coefficient` - multiplier for calculation
     - `is_percentage` - whether result is percentage
   - Supports complex calculation chains
   - Parameters execute in strict order

3. **Tender Markup Percentages** (`tender_markup_percentage` table)
   - Links tactic to specific tender
   - Stores calculated base percentages per tender
   - Applied during BOQ item price calculations

**Key Features:**
- Drag-and-drop reordering of parameters
- Copy tactics functionality
- Tender-specific overrides
- Calculation order matters (sequential processing)
- Real-time price recalculation on parameter changes

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

**Additional Works (ДОП) System:**
- Create additional works from any regular position via "+" button in "Итого" column
- Additional works marked with `is_additional = true` and linked via `parent_position_id`
- Numbering uses decimal system: parent 5 → additional works 5.1, 5.2, 5.3
- `position_number` type: `numeric(10,2)` to support decimal numbering
- Visual: 20px indent and orange "ДОП" tag instead of section number
- Additional works are leaf positions (can contain works/materials)
- Cannot create nested additional works (button hidden for ДОП positions)
- Editable fields in PositionItems: work name, unit code, GP volume, GP note

### BOQ Items (`/positions/:positionId/items`)
**Works and materials management for each client position**

**Price Calculation Fields:**
- `initial_price` - Base price from library
- `calculated_price` - Price after markup application
- `total_price` - calculated_price × quantity
- Auto-recalculated on markup changes

**Instant Add Interface:**
- Two AutoComplete fields side-by-side (works | materials)
- Green + buttons for instant addition
- Auto-populates data from libraries
- Prices calculated immediately on add

**Material-to-Work Linking:**
- `parent_work_item_id` - soft link to work (ON DELETE SET NULL)
- `conversion_coefficient` - material consumption per work unit
- Materials can be standalone or linked to specific works

## Commerce Page (`/commerce`)
**Position-level commercial analysis**
- Shows all positions with calculated totals
- Tracks materials and works costs separately
- Profit calculation and percentage analysis
- Color-coded profit indicators
- Real-time updates from BOQ changes

## Construction Costs Pages

### Two Pages for Different Purposes:

#### `/admin/construction_cost` - Справочник затрат (Cost Reference Catalog)
**File**: `src/pages/Admin/ConstructionCost/ConstructionCost.tsx`
**Purpose**: Managing the structure and catalog of cost categories

**Features**:
- CRUD operations for cost categories and detailed items
- Import structure from Excel with auto-detection of new units
- 3-level hierarchy: Category → Detail → Location
- Edit names, units, locations
- Delete items and bulk delete all costs
- Expand/collapse all categories

**Database tables**:
- `cost_categories` (read/write)
- `detail_cost_categories` (read/write)
- `units` (read/write)

**Use cases**:
- Setting up initial cost structure
- Adding new types of works/materials
- Importing cost structure from Excel
- Managing cost catalog for organization

#### `/costs` - Затраты на строительство (Construction Costs Analysis)
**File**: `src/pages/Admin/ConstructionCostNew/ConstructionCostNew.tsx`
**Purpose**: Analyzing costs for specific tenders with calculations

**Features**:
- Select tender and version
- Toggle between "Direct costs" / "Commercial costs"
- Edit work volumes (stored in `construction_cost_volumes`)
- Automatic calculation from BOQ items
- Breakdown by types: Materials, Works, Sub-materials, Sub-works, Component materials, Component works
- Export to Excel with dual view (direct + commercial costs)
- Detailed/Summary view modes
- Hide zero values
- Search and filter by categories/types/locations
- Shows only categories used in selected tender (by default)

**Database tables**:
- `tenders` (read - for selection)
- `detail_cost_categories` (read - structure)
- `construction_cost_volumes` (read/write - volumes per tender)
- `boq_items` (read - cost calculations with pricing distribution)

**Use cases**:
- Viewing costs for specific tender
- Editing work volumes
- Comparing direct vs commercial costs
- Exporting cost reports to Excel
- Analyzing cost distribution by types

## Templates Architecture

### Two-Table Structure
- `templates` - Container table (template metadata)
- `template_items` - Universal table for BOTH works AND materials

### Table: template_items
Universal table using **discriminator column `kind`**:
- `kind` = `'work'` → row represents a work
- `kind` = `'material'` → row represents a material

### Business Logic (CHECK Constraints)
**For works** (kind = 'work'):
- work_library_id IS NOT NULL
- material_library_id IS NULL
- No parent work linking

**For materials** (kind = 'material'):
- material_library_id IS NOT NULL
- work_library_id IS NULL
- Can optionally link to parent work with conversion coefficient

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