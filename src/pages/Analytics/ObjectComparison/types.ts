export type CostType = 'base' | 'commercial';
export type ViewMode = 'detailed' | 'simplified';

export interface ComparisonRow {
  key: string;
  category: string;
  is_main_category?: boolean;
  tender1_materials: number;
  tender1_works: number;
  tender1_total: number;
  tender2_materials: number;
  tender2_works: number;
  tender2_total: number;
  diff_materials: number;
  diff_works: number;
  diff_total: number;
  diff_materials_percent: number;
  diff_works_percent: number;
  diff_total_percent: number;
  // Per-unit costs (cost / volume)
  tender1_mat_per_unit: number;
  tender1_work_per_unit: number;
  tender1_total_per_unit: number;
  tender2_mat_per_unit: number;
  tender2_work_per_unit: number;
  tender2_total_per_unit: number;
  diff_mat_per_unit: number;
  diff_work_per_unit: number;
  diff_total_per_unit: number;
  volume1: number;
  volume2: number;
  children?: ComparisonRow[];
}
