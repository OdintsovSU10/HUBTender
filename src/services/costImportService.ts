import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface ImportData {
  orderNum: number;
  categoryName: string;
  categoryUnit: string;
  costName: string;
  costUnit: string;
  location: string;
}

export const costImportService = {
  /**
   * Обработка и импорт данных из Excel файла
   * @param file - Excel файл для импорта
   * @param onProgress - Callback для отслеживания прогресса
   * @returns Количество импортированных записей или ошибка
   */
  async importFromExcel(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; recordsAdded: number; error?: string }> {
    try {
      // Читаем файл
      const data = await readExcelFile(file);

      if (!data || data.length === 0) {
        return { success: false, recordsAdded: 0, error: 'Файл не содержит данных для импорта' };
      }

      onProgress?.(10);

      // Парсим данные
      const { categories, locations, detailItems } = parseImportData(data);

      onProgress?.(30);

      // Импортируем локации
      const locationMap = await importLocations(locations);

      onProgress?.(50);

      // Импортируем категории
      const categoryMap = await importCategories(categories);

      onProgress?.(70);

      // Импортируем детальные категории
      const recordsAdded = await importDetailCategories(detailItems, categoryMap, locationMap);

      onProgress?.(100);

      return { success: true, recordsAdded };
    } catch (error) {
      console.error('Ошибка импорта:', error);
      return {
        success: false,
        recordsAdded: 0,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
};

/**
 * Чтение Excel файла
 */
async function readExcelFile(file: File): Promise<any[][] | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Пропускаем заголовки и пустые строки
        const dataRows = jsonData.slice(1).filter(row => row && row.length >= 6);
        resolve(dataRows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Парсинг импортируемых данных
 */
function parseImportData(rows: any[][]) {
  const uniqueCategories = new Map<string, { name: string; unit: string }>();
  const uniqueLocations = new Set<string>();
  const detailItems: ImportData[] = [];

  rows.forEach(row => {
    const [orderNum, categoryName, categoryUnit, costName, costUnit, location] = row;

    // Добавляем категорию
    if (categoryName && categoryUnit) {
      const key = `${categoryName}_${categoryUnit}`;
      if (!uniqueCategories.has(key)) {
        uniqueCategories.set(key, {
          name: String(categoryName).trim(),
          unit: String(categoryUnit).trim()
        });
      }
    }

    // Добавляем локацию
    if (location) {
      uniqueLocations.add(String(location).trim());
    }

    // Добавляем детальную запись
    if (orderNum && costName && costUnit) {
      detailItems.push({
        orderNum: Number(orderNum),
        categoryName: String(categoryName).trim(),
        categoryUnit: String(categoryUnit).trim(),
        costName: String(costName).trim(),
        costUnit: String(costUnit).trim(),
        location: String(location).trim(),
      });
    }
  });

  return {
    categories: uniqueCategories,
    locations: uniqueLocations,
    detailItems
  };
}

/**
 * Импорт локаций в базу данных
 */
async function importLocations(locations: Set<string>): Promise<Map<string, string>> {
  const locationMap = new Map<string, string>();

  for (const location of locations) {
    try {
      // Проверяем существование локации
      let { data: existingLocation } = await supabase
        .from('locations')
        .select('id')
        .eq('location', location)
        .maybeSingle();

      if (existingLocation) {
        locationMap.set(location, existingLocation.id);
      } else {
        // Создаем новую локацию
        const { data: newLocation, error } = await supabase
          .from('locations')
          .insert({ location })
          .select('id')
          .single();

        if (error) throw error;
        if (newLocation) {
          locationMap.set(location, newLocation.id);
        }
      }
    } catch (error) {
      console.error(`Ошибка при обработке локации "${location}":`, error);
    }
  }

  return locationMap;
}

/**
 * Импорт категорий затрат в базу данных
 */
async function importCategories(
  categories: Map<string, { name: string; unit: string }>
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();

  for (const [key, category] of categories) {
    try {
      // Проверяем существование категории
      let { data: existingCategory } = await supabase
        .from('cost_categories')
        .select('id')
        .eq('name', category.name)
        .eq('unit', category.unit)
        .maybeSingle();

      if (existingCategory) {
        categoryMap.set(key, existingCategory.id);
      } else {
        // Создаем новую категорию
        const { data: newCategory, error } = await supabase
          .from('cost_categories')
          .insert({
            name: category.name,
            unit: category.unit,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (newCategory) {
          categoryMap.set(key, newCategory.id);
        }
      }
    } catch (error) {
      console.error(`Ошибка при обработке категории "${category.name}":`, error);
    }
  }

  return categoryMap;
}

/**
 * Импорт детальных категорий затрат
 */
async function importDetailCategories(
  detailItems: ImportData[],
  categoryMap: Map<string, string>,
  locationMap: Map<string, string>
): Promise<number> {
  const detailsToInsert = [];

  for (const item of detailItems) {
    const categoryKey = `${item.categoryName}_${item.categoryUnit}`;
    const categoryId = categoryMap.get(categoryKey);
    const locationId = locationMap.get(item.location);

    if (categoryId && locationId) {
      try {
        // Проверяем существование записи
        const { data: existing } = await supabase
          .from('detail_cost_categories')
          .select('id')
          .eq('cost_category_id', categoryId)
          .eq('location_id', locationId)
          .eq('name', item.costName)
          .maybeSingle();

        if (!existing) {
          detailsToInsert.push({
            cost_category_id: categoryId,
            location_id: locationId,
            name: item.costName,
            unit: item.costUnit,
            order_num: item.orderNum,
          });
        }
      } catch (error) {
        console.error('Ошибка при проверке существующей записи:', error);
      }
    }
  }

  // Вставляем все новые записи одним запросом
  if (detailsToInsert.length > 0) {
    const { error } = await supabase
      .from('detail_cost_categories')
      .insert(detailsToInsert);

    if (error) {
      console.error('Ошибка при вставке детальных категорий:', error);
      throw error;
    }
  }

  return detailsToInsert.length;
}