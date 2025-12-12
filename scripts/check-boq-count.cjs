/**
 * Проверка количества BOQ элементов для позиции
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBoqCount() {
  try {
    const POSITION_ID = 'dc2b0751-ef03-4b3e-8de0-c578b9d69967';

    console.log(`🔍 Проверка BOQ элементов для позиции ${POSITION_ID}\n`);

    // Получаем позицию
    const { data: position } = await supabase
      .from('client_positions')
      .select('*')
      .eq('id', POSITION_ID)
      .single();

    console.log(`Позиция: ${position.position_number} - ${position.work_name}\n`);

    // Получаем ВСЕ boq_items для позиции
    const { data: boqItems, error } = await supabase
      .from('boq_items')
      .select('*')
      .eq('client_position_id', POSITION_ID)
      .order('created_at');

    if (error) throw error;

    console.log(`✅ Найдено BOQ элементов: ${boqItems?.length || 0}\n`);

    if (!boqItems || boqItems.length === 0) {
      console.log('❌ Нет BOQ элементов');
      return;
    }

    // Считаем суммы
    let totalAmount = 0;
    let baseTotal = 0;
    let commercialMaterial = 0;
    let commercialWork = 0;

    console.log(`Элементы:\n`);
    boqItems.forEach((item, idx) => {
      const itemTotal = item.total_amount || 0;
      const itemMat = item.total_commercial_material_cost || 0;
      const itemWork = item.total_commercial_work_cost || 0;

      console.log(`${idx + 1}. ${item.boq_item_type} - ${item.work_name || item.material_name || 'Без названия'}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   total_amount: ${itemTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
      console.log(`   commercial_material: ${itemMat.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
      console.log(`   commercial_work: ${itemWork.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
      console.log(`   created_at: ${item.created_at}`);
      console.log(`   updated_at: ${item.updated_at}\n`);

      totalAmount += itemTotal;
      baseTotal += itemTotal;
      commercialMaterial += itemMat;
      commercialWork += itemWork;
    });

    console.log(`\n${'='.repeat(80)}\n`);
    console.log(`ИТОГО:`);
    console.log(`  total_amount (Позиции заказчика): ${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`);
    console.log(`  base_total (Базовая в коммерции): ${baseTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`);
    console.log(`  commercial_material: ${commercialMaterial.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`);
    console.log(`  commercial_work: ${commercialWork.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`);
    console.log(`  commercial_total: ${(commercialMaterial + commercialWork).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkBoqCount();
