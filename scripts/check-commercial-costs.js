import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCommercialCosts() {
  console.log('🔍 ПРОВЕРКА КОММЕРЧЕСКИХ СТОИМОСТЕЙ В БД\n');

  // Получаем первый тендер
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, tender_number, title')
    .limit(1);

  if (!tenders || tenders.length === 0) {
    console.error('❌ Тендеры не найдены');
    return;
  }

  const tender = tenders[0];
  console.log(`📋 Тендер: ${tender.tender_number} - ${tender.title}`);
  console.log(`🆔 ID: ${tender.id}\n`);

  // Проверяем BOQ элементы
  const { data: boqItems, error } = await supabase
    .from('boq_items')
    .select('id, quantity, total_amount, total_commercial_material_cost, total_commercial_work_cost')
    .eq('tender_id', tender.id)
    .limit(10);

  if (error) {
    console.error('❌ Ошибка:', error);
    return;
  }

  console.log(`📊 Найдено BOQ элементов: ${boqItems.length}\n`);

  let hasCommercialCosts = false;
  let emptyCount = 0;

  boqItems.forEach((item, i) => {
    console.log(`${i + 1}. ID: ${item.id.substring(0, 8)}...`);
    console.log(`   Количество: ${item.quantity}`);
    console.log(`   Базовая стоимость (total_amount): ${item.total_amount || 0}`);
    console.log(`   💰 Коммерч. материалы: ${item.total_commercial_material_cost || 0}`);
    console.log(`   💰 Коммерч. работы: ${item.total_commercial_work_cost || 0}`);

    if (item.total_commercial_material_cost || item.total_commercial_work_cost) {
      hasCommercialCosts = true;
    } else {
      emptyCount++;
    }
    console.log('');
  });

  console.log('📈 ИТОГИ:');
  console.log(`   Элементов с коммерческими стоимостями: ${boqItems.length - emptyCount}`);
  console.log(`   Элементов БЕЗ коммерческих стоимостей: ${emptyCount}`);

  if (emptyCount === boqItems.length) {
    console.log('\n⚠️  ВСЕ элементы имеют пустые коммерческие стоимости!');
    console.log('   Необходимо выполнить пересчёт с применением тактики наценок.');
    console.log('   Используйте кнопку "Пересчитать" на странице Коммерция.');
  }

  // Найдем client_position_id первого BOQ элемента с коммерческими стоимостями
  if (boqItems && boqItems.length > 0 && boqItems[0]) {
    const testItem = boqItems[0];

    // Получим позицию этого элемента
    const { data: positionData } = await supabase
      .from('boq_items')
      .select('client_position_id')
      .eq('id', testItem.id)
      .single();

    if (positionData) {
      const { data: position } = await supabase
        .from('client_positions')
        .select('id, work_name, volume')
        .eq('id', positionData.client_position_id)
        .single();

      if (position) {
        console.log(`\n📍 Проверка позиции с BOQ элементами: ${position.work_name}`);
        console.log(`   Объём: ${position.volume || 'не указан'}`);

        const { data: posItems } = await supabase
          .from('boq_items')
          .select('total_commercial_material_cost, total_commercial_work_cost')
          .eq('client_position_id', position.id);

        let matTotal = 0;
        let workTotal = 0;

        posItems?.forEach(item => {
          matTotal += item.total_commercial_material_cost || 0;
          workTotal += item.total_commercial_work_cost || 0;
        });

        console.log(`   Всего BOQ элементов: ${posItems?.length || 0}`);
        console.log(`   Сумма материалов: ${matTotal.toFixed(2)}`);
        console.log(`   Сумма работ: ${workTotal.toFixed(2)}`);

        if (position.volume && position.volume > 0) {
          console.log(`   💰 Цена за ед. материалов: ${(matTotal / position.volume).toFixed(2)}`);
          console.log(`   💰 Цена за ед. работ: ${(workTotal / position.volume).toFixed(2)}`);
        } else {
          console.log(`   ⚠️  Нельзя рассчитать цену за единицу - объём не указан`);
        }
      }
    }
  }
}

checkCommercialCosts();
