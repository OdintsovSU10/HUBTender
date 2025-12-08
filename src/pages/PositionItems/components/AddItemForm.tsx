import React from 'react';
import { AutoComplete, Button } from 'antd';
import { PlusOutlined, FileAddOutlined } from '@ant-design/icons';
import type { WorkLibraryFull, MaterialLibraryFull } from '../../../lib/supabase';

interface AddItemFormProps {
  works: WorkLibraryFull[];
  materials: MaterialLibraryFull[];
  workSearchText: string;
  materialSearchText: string;
  onWorkSearchChange: (value: string) => void;
  onMaterialSearchChange: (value: string) => void;
  onAddWork: (workNameId: string) => void;
  onAddMaterial: (materialNameId: string) => void;
  onOpenTemplateModal: () => void;
  disabled?: boolean;
}

const AddItemForm: React.FC<AddItemFormProps> = ({
  works,
  materials,
  workSearchText,
  materialSearchText,
  onWorkSearchChange,
  onMaterialSearchChange,
  onAddWork,
  onAddMaterial,
  onOpenTemplateModal,
  disabled,
}) => {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      {/* Колонка 1: Добавить работу */}
      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
        <AutoComplete
          style={{ flex: 1 }}
          placeholder="Выберите или начните вводить работу..."
          disabled={disabled}
          options={works
            .filter(w => {
              if (!workSearchText) return true;
              return w.work_name.toLowerCase().includes(workSearchText.toLowerCase());
            })
            .slice(0, 100)
            .map(w => ({
              value: w.work_name,
              label: w.work_name,
            }))
          }
          value={workSearchText}
          onChange={onWorkSearchChange}
          onSelect={onWorkSearchChange}
          onClear={() => onWorkSearchChange('')}
          allowClear
          filterOption={false}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#10b981' }}
          disabled={disabled || !workSearchText || works.filter(w =>
            w.work_name.toLowerCase().includes(workSearchText.toLowerCase())
          ).length === 0}
          onClick={() => {
            const work = works.find(w =>
              w.work_name.toLowerCase() === workSearchText.toLowerCase() ||
              w.work_name.toLowerCase().includes(workSearchText.toLowerCase())
            );
            if (work) {
              onAddWork(work.work_name_id);
            }
          }}
        />
      </div>

      {/* Колонка 2: Добавить материал */}
      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
        <AutoComplete
          style={{ flex: 1 }}
          placeholder="Выберите или начните вводить материал..."
          disabled={disabled}
          options={materials
            .filter(m => {
              if (!materialSearchText) return true;
              return m.material_name.toLowerCase().includes(materialSearchText.toLowerCase());
            })
            .slice(0, 100)
            .map(m => ({
              value: m.material_name,
              label: m.material_name,
            }))
          }
          value={materialSearchText}
          onChange={onMaterialSearchChange}
          onSelect={onMaterialSearchChange}
          onClear={() => onMaterialSearchChange('')}
          allowClear
          filterOption={false}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#10b981' }}
          disabled={disabled || !materialSearchText || materials.filter(m =>
            m.material_name.toLowerCase().includes(materialSearchText.toLowerCase())
          ).length === 0}
          onClick={() => {
            const material = materials.find(m =>
              m.material_name.toLowerCase() === materialSearchText.toLowerCase() ||
              m.material_name.toLowerCase().includes(materialSearchText.toLowerCase())
            );
            if (material) {
              onAddMaterial(material.material_name_id);
            }
          }}
        />
      </div>

      {/* Колонка 3: Вставить шаблон */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Button
          type="primary"
          icon={<FileAddOutlined />}
          onClick={onOpenTemplateModal}
          disabled={disabled}
          style={{ background: '#10b981', width: '100%' }}
        >
          Вставить шаблон
        </Button>
      </div>
    </div>
  );
};

export default AddItemForm;
