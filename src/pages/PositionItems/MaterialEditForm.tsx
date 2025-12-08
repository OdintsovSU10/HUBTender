import { useState, useEffect } from 'react';
import { Button, Select, AutoComplete, InputNumber, Input, message } from 'antd';
import { CloseOutlined, SaveOutlined, LinkOutlined } from '@ant-design/icons';
import type { BoqItemFull, CurrencyType } from '../../lib/supabase';

interface MaterialEditFormProps {
  record: BoqItemFull;
  materialNames: any[];
  workItems: BoqItemFull[]; // Список работ для привязки
  costCategories: any[];
  currencyRates: { usd: number; eur: number; cny: number };
  gpVolume: number; // Количество ГП из позиции заказчика
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

// Компонент для заголовка поля с опциональной звездочкой
const FieldLabel: React.FC<{ label: string; required?: boolean; align?: 'left' | 'center' }> = ({ label, required, align = 'center' }) => (
  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: align }}>
    {required && <span style={{ color: 'red', marginRight: '4px' }}>*</span>}
    {label}
  </div>
);

// Функция для получения цвета border на основе типа материала
const getBorderColor = (type: string) => {
  switch (type) {
    case 'мат':
      return '#2196f3';
    case 'суб-мат':
      return '#9ccc65';
    case 'мат-комп.':
      return '#00897b';
    default:
      return '#d9d9d9';
  }
};

const MaterialEditForm: React.FC<MaterialEditFormProps> = ({
  record,
  materialNames,
  workItems,
  costCategories,
  currencyRates,
  gpVolume,
  onSave,
  onCancel,
  readOnly,
}) => {
  const [formData, setFormData] = useState<any>({
    boq_item_type: record.boq_item_type,
    material_type: record.material_type || 'основн.',
    material_name_id: record.material_name_id,
    unit_code: record.unit_code,
    parent_work_item_id: record.parent_work_item_id || null,
    consumption_coefficient: record.consumption_coefficient || 1,
    conversion_coefficient: record.conversion_coefficient || 1,
    base_quantity: record.base_quantity || 0,
    quantity: record.quantity || 0,
    unit_rate: record.unit_rate || 0,
    currency_type: record.currency_type || 'RUB',
    delivery_price_type: record.delivery_price_type || 'в цене',
    delivery_amount: record.delivery_amount || 0,
    detail_cost_category_id: record.detail_cost_category_id,
    quote_link: record.quote_link || '',
    description: record.description || '',
  });

  const [materialSearchText, setMaterialSearchText] = useState<string>(record.material_name || '');

  const [costSearchText, setCostSearchText] = useState<string>(record.detail_cost_category_full || '');

  // Функция для получения курса валюты
  const getCurrencyRate = (currency: CurrencyType): number => {
    switch (currency) {
      case 'USD':
        return currencyRates.usd;
      case 'EUR':
        return currencyRates.eur;
      case 'CNY':
        return currencyRates.cny;
      case 'RUB':
      default:
        return 1;
    }
  };

  // Вычисление количества
  const calculateQuantity = (): number => {
    if (formData.parent_work_item_id) {
      // Материал привязан к работе
      const parentWork = workItems.find((w) => w.id === formData.parent_work_item_id);
      if (parentWork && parentWork.quantity) {
        return parentWork.quantity * formData.conversion_coefficient * formData.consumption_coefficient;
      }
      return 0;
    } else {
      // Материал не привязан к работе - используем количество ГП
      return gpVolume * formData.consumption_coefficient;
    }
  };

  // Вычисление цены доставки
  const calculateDeliveryPrice = (): number => {
    const rate = getCurrencyRate(formData.currency_type);
    const unitPriceInRub = formData.unit_rate * rate;

    if (formData.delivery_price_type === 'не в цене') {
      return unitPriceInRub * 0.03;
    } else if (formData.delivery_price_type === 'суммой') {
      return formData.delivery_amount || 0;
    } else {
      // 'в цене'
      return 0;
    }
  };

  // Вычисление суммы
  const calculateTotal = (): number => {
    const qty = calculateQuantity();
    const rate = getCurrencyRate(formData.currency_type);
    const deliveryPrice = calculateDeliveryPrice();
    const total = qty * (formData.unit_rate * rate + deliveryPrice);
    return Math.round(total * 100) / 100;
  };

  // Обновление количества при изменении зависимых полей
  useEffect(() => {
    const newQuantity = calculateQuantity();
    setFormData((prev: any) => ({ ...prev, quantity: newQuantity }));
  }, [
    formData.parent_work_item_id,
    formData.conversion_coefficient,
    formData.consumption_coefficient,
    gpVolume,
  ]);

  // Обработчик сохранения
  const handleSave = async () => {
    if (!formData.material_name_id) {
      message.error('Выберите наименование материала');
      return;
    }

    // Проверка на коэффициент расхода
    if (formData.consumption_coefficient < 1.0) {
      message.error('Значение коэффициента расхода не может быть менее 1,00');
      return;
    }

    if (!formData.detail_cost_category_id) {
      message.error('Выберите затрату на строительство');
      return;
    }

    // Подготовить данные для сохранения
    const dataToSave: any = {
      ...formData,
    };

    // Если материал не привязан к работе
    if (!formData.parent_work_item_id) {
      // Проверка на корректность количества ГП
      if (!gpVolume || gpVolume <= 0) {
        message.error('Введите количество ГП');
        return;
      }
      // Явно устанавливаем null для отвязанного материала
      dataToSave.parent_work_item_id = null;
      dataToSave.conversion_coefficient = null;
      // Использовать количество ГП как базовое количество
      dataToSave.base_quantity = gpVolume;
      dataToSave.quantity = gpVolume * formData.consumption_coefficient;
    } else {
      // Если материал привязан к работе, очистить base_quantity
      dataToSave.parent_work_item_id = formData.parent_work_item_id;
      dataToSave.base_quantity = null;
      dataToSave.quantity = calculateQuantity();
    }

    const totalAmount = calculateTotal();
    dataToSave.total_amount = totalAmount;

    await onSave(dataToSave);
  };

  // Получить опции для AutoComplete затрат
  const getCostCategoryOptions = () => {
    return costCategories
      .filter((c) => c.label.toLowerCase().includes(costSearchText.toLowerCase()))
      .map((c) => ({
        value: c.label,
        id: c.value,
        label: c.label,
      }));
  };

  // Получить опции для AutoComplete наименований материалов
  const getMaterialNameOptions = () => {
    const searchText = materialSearchText || '';
    if (searchText.length < 2) return [];

    return materialNames
      .filter((m) => m.name.toLowerCase().includes(searchText.toLowerCase()))
      .map((m) => ({
        value: m.id,
        label: m.name,
        id: m.id,
        unit: m.unit,
      }));
  };

  return (
    <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
      <div style={{ padding: '16px', border: `2px solid ${getBorderColor(formData.boq_item_type)}`, borderRadius: '4px' }}>
      {/* Строка 1: Тип | Вид | Наименование | Привязка */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <div style={{ width: '120px' }}>
          <FieldLabel label="Тип" />
          <Select
            value={formData.boq_item_type}
            onChange={(value) => setFormData({ ...formData, boq_item_type: value })}
            style={{ width: '100%' }}
            size="small"
            options={[
              { value: 'мат', label: 'мат' },
              { value: 'суб-мат', label: 'суб-мат' },
              { value: 'мат-комп.', label: 'мат-комп.' },
            ]}
          />
        </div>

        <div style={{ width: '120px' }}>
          <FieldLabel label="Вид" />
          <Select
            value={formData.material_type}
            onChange={(value) => setFormData({ ...formData, material_type: value })}
            style={{ width: '100%' }}
            size="small"
            options={[
              { value: 'основн.', label: 'основн.' },
              { value: 'вспомогат.', label: 'вспомогат.' },
            ]}
          />
        </div>

        <div style={{ flex: 2 }}>
          <FieldLabel label="Наименование" required />
          <AutoComplete
            value={materialSearchText}
            onChange={(value) => {
              setMaterialSearchText(value);
            }}
            onSelect={(_value, option: any) => {
              setFormData({
                ...formData,
                material_name_id: option.id,
                unit_code: option.unit,
              });
              setMaterialSearchText(option.label);
            }}
            onClear={() => {
              setMaterialSearchText('');
              setFormData({
                ...formData,
                material_name_id: null,
                unit_code: null,
              });
            }}
            options={getMaterialNameOptions()}
            placeholder="Выберите материал"
            style={{ width: '100%' }}
            size="small"
            filterOption={false}
            allowClear
          />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>
            <LinkOutlined style={{ marginRight: 4 }} />
            Привязка
          </div>
          <Select
            value={formData.parent_work_item_id}
            onChange={(value) => {
              // При отвязке сбрасываем conversion_coefficient
              setFormData({
                ...formData,
                parent_work_item_id: value || null,
                conversion_coefficient: value ? formData.conversion_coefficient : 1,
              });
            }}
            style={{ width: '100%' }}
            size="small"
            allowClear
            placeholder="Без привязки"
            options={workItems.map((w) => ({
              value: w.id,
              label: w.work_name,
            }))}
          />
        </div>
      </div>

      {/* Строка 2: К перев | К расх | Баз.кол-во | Кол-во | Ед.изм | Цена | Валюта | Доставка | Сум.дост. */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>

        {/* К перев - показываем только если выбрана привязка */}
        {formData.parent_work_item_id && (
          <div style={{ width: '80px' }}>
            <FieldLabel label="К перев" />
            <InputNumber
              value={formData.conversion_coefficient}
              onChange={(value) => setFormData({ ...formData, conversion_coefficient: value || 1 })}
              placeholder="1.00000"
              precision={5}
              style={{ width: '100%' }}
              size="small"
              parser={(value) => parseFloat(value!.replace(/,/g, '.'))}
            />
          </div>
        )}

        <div style={{ width: '80px' }}>
          <FieldLabel label="К расх" required />
          <InputNumber
            value={formData.consumption_coefficient}
            onChange={(value) => setFormData({ ...formData, consumption_coefficient: value || 1 })}
            placeholder="1.00000"
            precision={5}
            min={1.0}
            style={{ width: '100%' }}
            size="small"
            parser={(value) => parseFloat(value!.replace(/,/g, '.'))}
          />
        </div>

        <div style={{ width: '100px' }}>
          <FieldLabel label="Кол-во" />
          <InputNumber
            value={formData.quantity}
            disabled
            placeholder="0.00000"
            precision={5}
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        <div style={{ width: '60px' }}>
          <FieldLabel label="Ед.изм." />
          <Input
            value={formData.unit_code || '-'}
            disabled
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        <div style={{ width: '100px' }}>
          <FieldLabel label="Цена за ед." />
          <InputNumber
            value={formData.unit_rate}
            onChange={(value) => setFormData({ ...formData, unit_rate: value || 0 })}
            placeholder="0.00"
            precision={2}
            style={{ width: '100%' }}
            size="small"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            parser={(value) => value!.replace(/\s/g, '').replace(/,/g, '.')}
          />
        </div>

        <div style={{ width: '80px' }}>
          <FieldLabel label="Валюта" />
          <Select
            value={formData.currency_type}
            onChange={(value) => setFormData({ ...formData, currency_type: value })}
            style={{ width: '100%' }}
            size="small"
            options={[
              { value: 'RUB', label: '₽' },
              { value: 'USD', label: '$' },
              { value: 'EUR', label: '€' },
              { value: 'CNY', label: '¥' },
            ]}
          />
        </div>

        <div style={{ width: '120px' }}>
          <FieldLabel label="Доставка" />
          <Select
            value={formData.delivery_price_type}
            onChange={(value) => {
              // При смене типа доставки устанавливаем значение по умолчанию
              // Для 'не в цене' используется фиксированный 3%, поэтому delivery_amount = null
              // Для 'суммой' нужна сумма, по умолчанию 100
              // Для 'в цене' доставка включена, поэтому delivery_amount = null
              const newDeliveryAmount = value === 'суммой' ? 100 : null;
              setFormData({ ...formData, delivery_price_type: value, delivery_amount: newDeliveryAmount });
            }}
            style={{ width: '100%' }}
            size="small"
            options={[
              { value: 'в цене', label: 'в цене' },
              { value: 'не в цене', label: 'не в цене' },
              { value: 'суммой', label: 'суммой' },
            ]}
          />
        </div>

        {/* Сумма доставки - показываем только если тип "суммой" */}
        {formData.delivery_price_type === 'суммой' && (
          <div style={{ width: '100px' }}>
            <FieldLabel label="Сум. дост." />
            <InputNumber
              value={formData.delivery_amount}
              onChange={(value) => setFormData({ ...formData, delivery_amount: value || 0 })}
              placeholder="0.00"
              precision={2}
              style={{ width: '100%' }}
              size="small"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={(value) => value!.replace(/\s/g, '').replace(/,/g, '.')}
            />
          </div>
        )}

        <div style={{ width: '120px' }}>
          <FieldLabel label="Итого" />
          <InputNumber
            value={calculateTotal()}
            disabled
            placeholder="0.00"
            precision={2}
            style={{ width: '100%' }}
            size="small"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          />
        </div>

        {/* Затрата на строительство (flex для заполнения остального пространства) */}
        <div style={{ flex: 1 }}>
          <FieldLabel label="Затрата на строительство" required />
          <AutoComplete
            value={costSearchText}
            onChange={(value) => {
              setCostSearchText(value);
            }}
            onSelect={(_value, option: any) => {
              setFormData({
                ...formData,
                detail_cost_category_id: option.id,
              });
              setCostSearchText(option.label);
            }}
            options={getCostCategoryOptions()}
            placeholder="Выберите затрату на строительство"
            style={{ width: '100%' }}
            size="small"
            filterOption={false}
            allowClear
            onClear={() => {
              setCostSearchText('');
              setFormData({
                ...formData,
                detail_cost_category_id: null,
              });
            }}
          />
        </div>
      </div>

      {/* Строка 3: Ссылка на КП | Примечание (50/50) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <FieldLabel label="Ссылка на КП" align="left" />
          <Input
            value={formData.quote_link}
            onChange={(e) => setFormData({ ...formData, quote_link: e.target.value })}
            placeholder="Ссылка на коммерческое предложение"
            style={{ width: '100%' }}
            size="small"
            allowClear
          />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel label="Примечание" align="left" />
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Примечание к элементу"
            style={{ width: '100%' }}
            size="small"
            allowClear
          />
        </div>
      </div>

      {/* Кнопки действий */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          onClick={handleSave}
          style={{ background: '#10b981' }}
        >
          Сохранить
        </Button>
      </div>
    </div>
    </fieldset>
  );
};

export default MaterialEditForm;
