/**
 * Проверка структуры отделочных работ в базе данных
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinishingWorks() {
  try {
    console.log('🔍 Проверка структуры отделочных работ\n');

    // Найти категорию "Отделочные работы"
    const { data: categories } = await supabase
      .from('cost_categories')
      .select('*')
      .ilike('name', '%отделочн%');

    if (!categories || categories.length === 0) {
      console.log('❌ Категория "Отделочные работы" не найдена');
      return;
    }

    console.log(`✅ Найдено категорий с "отделочн": ${categories.length}\n`);
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
    });

    const finishingCategory = categories[0];
    console.log(`\n📋 Используется категория: ${finishingCategory.name}\n`);

    // Получить все детальные категории для отделочных работ
    const { data: details } = await supabase
      .from('detail_cost_categories')
      .select('*')
      .eq('cost_category_id', finishingCategory.id)
      .order('location')
      .order('name');

    if (!details || details.length === 0) {
      console.log('❌ Нет детальных категорий');
      return;
    }

    console.log(`✅ Найдено детальных категорий: ${details.length}\n`);

    // Группировка по локализациям
    const byLocation = new Map();

    details.forEach(detail => {
      if (!byLocation.has(detail.location)) {
        byLocation.set(detail.location, []);
      }
      byLocation.get(detail.location).push(detail);
    });

    console.log(`📍 Уникальных локализаций: ${byLocation.size}\n`);

    // Вывод структуры
    console.log(`${'='.repeat(80)}`);
    console.log(`СТРУКТУРА: ${finishingCategory.name}`);
    console.log(`${'='.repeat(80)}\n`);

    for (const [location, items] of byLocation.entries()) {
      console.log(`📍 Локализация: ${location} (${items.length} затрат)`);
      items.forEach(item => {
        console.log(`   - ${item.name} (${item.unit})`);
      });
      console.log('');
    }

    // Проверка других категорий
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ПРОВЕРКА ДРУГИХ КАТЕГОРИЙ`);
    console.log(`${'='.repeat(80)}\n`);

    const { data: allCategories } = await supabase
      .from('cost_categories')
      .select('*')
      .order('name');

    if (allCategories) {
      for (const cat of allCategories) {
        const { data: catDetails } = await supabase
          .from('detail_cost_categories')
          .select('location')
          .eq('cost_category_id', cat.id);

        if (catDetails && catDetails.length > 0) {
          const uniqueLocations = new Set(catDetails.map(d => d.location));
          console.log(`${cat.name}:`);
          console.log(`  Всего затрат: ${catDetails.length}`);
          console.log(`  Уникальных локализаций: ${uniqueLocations.size}`);
          if (uniqueLocations.size > 1) {
            console.log(`  Локализации: ${Array.from(uniqueLocations).join(', ')}`);
          }
          console.log('');
        }
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkFinishingWorks();
