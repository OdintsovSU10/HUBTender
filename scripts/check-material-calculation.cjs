const { createClient } = require('@supabase/supabase-js');

// Read .env.local manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

// Split by both \r\n and \n to handle Windows line endings
envContent.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const equalIndex = line.indexOf('=');
    if (equalIndex > 0) {
      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      envVars[key] = value;
    }
  }
});

if (!envVars.VITE_SUPABASE_URL || !envVars.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables');
  console.error('Parsed keys:', Object.keys(envVars));
  console.error('URL:', envVars.VITE_SUPABASE_URL);
  console.error('KEY:', envVars.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing');
  process.exit(1);
}

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkMaterialCalculation() {
  try {
    // Найти тендер "ЖК События 6.2"
    const { data: tenders, error: tenderError } = await supabase
      .from('tenders')
      .select('*')
      .ilike('title', '%События%');

    if (tenderError) {
      console.error('Ошибка поиска тендера:', tenderError);
      return;
    }

    if (!tenders || tenders.length === 0) {
      console.log('Тендеры со словом "События" не найдены');
      return;
    }

    console.log('\n📋 Найденные тендеры:');
    tenders.forEach(t => {
      console.log(`  - ${t.title} (версия ${t.version})`);
    });

    // Используем первый найденный тендер
    const tender = tenders[0];
    console.log('\n📋 Используем тендер:', tender.title, 'v' + tender.version);
    console.log('ID:', tender.id);

    // Найти позицию заказчика
    const { data: position, error: posError } = await supabase
      .from('client_positions')
      .select('*')
      .eq('tender_id', tender.id)
      .ilike('work_name', '%молниезащит%')
      .single();

    if (posError) {
      console.error('Ошибка поиска позиции:', posError);
      return;
    }

    console.log('\n📌 Позиция:', position.work_name);
    console.log('ID:', position.id);
    console.log('Количество ГП (manual_volume):', position.manual_volume);
    console.log('Количество заказчика (volume):', position.volume);

    // Получить все элементы BOQ для этой позиции
    const { data: items, error: itemsError } = await supabase
      .from('boq_items')
      .select(`
        *,
        material_names(name, unit),
        work_names(name, unit)
      `)
      .eq('client_position_id', position.id)
      .order('sort_number');

    if (itemsError) {
      console.error('Ошибка получения элементов:', itemsError);
      return;
    }

    console.log('\n📦 Элементы BOQ:');
    console.log('Всего элементов:', items.length);

    // Проверить непривязанные материалы
    const unlinkedMaterials = items.filter(
      item => ['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type) && !item.parent_work_item_id
    );

    console.log('\n🔍 Непривязанные материалы:');
    console.log('Найдено:', unlinkedMaterials.length);

    for (const material of unlinkedMaterials) {
      const name = material.material_names?.name || 'Без названия';
      const unit = material.unit_code || '-';
      const baseQty = material.base_quantity || 0;
      const consumption = material.consumption_coefficient || 1;
      const quantity = material.quantity || 0;
      const unitRate = material.unit_rate || 0;
      const totalAmount = material.total_amount || 0;

      console.log('\n  📦', name);
      console.log('     Тип:', material.boq_item_type);
      console.log('     Базовое количество:', baseQty);
      console.log('     Коэфф. расхода:', consumption);
      console.log('     Количество (должно быть):', baseQty * consumption);
      console.log('     Количество (фактическое):', quantity);
      console.log('     ✅ Количество корректно:', Math.abs(quantity - baseQty * consumption) < 0.0001);

      console.log('\n     Цена за ед.:', unitRate, material.currency_type || 'RUB');
      console.log('     Итого (должно быть):', Math.round(quantity * unitRate * 100) / 100);
      console.log('     Итого (фактическое):', totalAmount);
      console.log('     ⚠️ Сумма корректна:', Math.abs(totalAmount - quantity * unitRate) < 0.01);
    }

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkMaterialCalculation();
