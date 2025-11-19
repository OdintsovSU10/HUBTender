import React, { useState, useEffect } from 'react';
import { Button, Select, AutoComplete, InputNumber, Input, message } from 'antd';
import { CloseOutlined, SaveOutlined, LinkOutlined } from '@ant-design/icons';
import type { BoqItemFull, BoqItemType, MaterialType, CurrencyType, DeliveryPriceType } from '../../lib/supabase';

interface MaterialEditFormProps {
  record: BoqItemFull;
  materialNames: any[];
  workItems: BoqItemFull[]; // Список работ для привязки
  costCategories: any[];
  currencyRates: { usd: number; eur: number; cny: number };
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

const MaterialEditForm: React.FC<MaterialEditFormProps> = ({
  record,
  materialNames,
  workItems,
  costCategories,
  currencyRates,
  onSave,
  onCancel,
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
      // Материал не привязан к работе
      return formData.base_quantity * formData.consumption_coefficient;
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
    return qty * (formData.unit_rate * rate + deliveryPrice);
  };

  // Обновление количества при изменении зависимых полей
  useEffect(() => {
    const newQuantity = calculateQuantity();
    setFormData((prev: any) => ({ ...prev, quantity: newQuantity }));
  }, [
    formData.parent_work_item_id,
    formData.conversion_coefficient,
    formData.consumption_coefficient,
    formData.base_quantity,
  ]);

  // Обработчик сохранения
  const handleSave = async () => {
    if (!formData.material_name_id) {
      message.error('Выберите наименование материала');
      return;
    }

    // Проверка на корректность количества
    if (!formData.parent_work_item_id && (!formData.base_quantity || formData.base_quantity <= 0)) {
      message.error('Введите базовое количество для непривязанного материала');
      return;
    }

    const totalAmount = calculateTotal();

    await onSave({
      ...formData,
      quantity: calculateQuantity(),
      total_amount: totalAmount,
    });
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
    <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
      {/* Строка 1: Тип | Вид | Наименование | Привязка */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <div style={{ width: '120px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Тип</div>
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Вид</div>
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Наименование</div>
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
              setFormData({
                ...formData,
                parent_work_item_id: value,
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
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>К перев</div>
            <InputNumber
              value={formData.conversion_coefficient}
              onChange={(value) => setFormData({ ...formData, conversion_coefficient: value || 1 })}
              placeholder="1.00"
              precision={3}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        )}

        <div style={{ width: '80px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>К расх</div>
          <InputNumber
            value={formData.consumption_coefficient}
            onChange={(value) => setFormData({ ...formData, consumption_coefficient: value || 1 })}
            placeholder="1.00"
            precision={3}
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        {/* Базовое количество - показываем только если нет привязки */}
        {!formData.parent_work_item_id && (
          <div style={{ width: '100px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Баз. кол-во</div>
            <InputNumber
              value={formData.base_quantity}
              onChange={(value) => setFormData({ ...formData, base_quantity: value || 0 })}
              placeholder="0.00"
              precision={2}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        )}

        <div style={{ width: '100px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Кол-во</div>
          <InputNumber
            value={formData.quantity}
            disabled
            placeholder="0.00"
            precision={3}
            style={{ width: '100%', backgroundColor: '#2a2a2a', color: '#888' }}
            size="small"
          />
        </div>

        <div style={{ width: '60px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Ед.изм.</div>
          <Input
            value={formData.unit_code || '-'}
            disabled
            style={{ width: '100%', backgroundColor: '#2a2a2a', color: '#888' }}
            size="small"
          />
        </div>

        <div style={{ width: '100px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Цена за ед.</div>
          <InputNumber
            value={formData.unit_rate}
            onChange={(value) => setFormData({ ...formData, unit_rate: value || 0 })}
            placeholder="0.00"
            precision={2}
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        <div style={{ width: '80px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Валюта</div>
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Доставка</div>
          <Select
            value={formData.delivery_price_type}
            onChange={(value) => setFormData({ ...formData, delivery_price_type: value })}
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
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Сум. дост.</div>
            <InputNumber
              value={formData.delivery_amount}
              onChange={(value) => setFormData({ ...formData, delivery_amount: value || 0 })}
              placeholder="0.00"
              precision={2}
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        )}

        <div style={{ width: '120px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Итого</div>
          <InputNumber
            value={calculateTotal()}
            disabled
            placeholder="0.00"
            precision={2}
            style={{ width: '100%', backgroundColor: '#2a2a2a', color: '#888' }}
            size="small"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          />
        </div>

        {/* Затрата на строительство (flex для заполнения остального пространства) */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textAlign: 'center' }}>Затрата на строительство</div>
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Ссылка на КП</div>
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Примечание</div>
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
  );
};

export default MaterialEditForm;
