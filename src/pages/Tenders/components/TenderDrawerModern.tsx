import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Input, DatePicker, Select, message, Button } from 'antd';
import { EditOutlined, CalendarOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FormInstance } from 'antd';
import type { TenderRegistryWithRelations, TenderStatus, ConstructionScope } from '../../../lib/supabase';
import { supabase } from '../../../lib/supabase';
import { getStatusBadge, getFileTypeColor } from '../utils/design';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../../../contexts/ThemeContext';

interface TenderDrawerModernProps {
  open: boolean;
  tender: TenderRegistryWithRelations | null;
  statuses: TenderStatus[];
  constructionScopes: ConstructionScope[];
  onClose: () => void;
  onUpdate: () => void;
  readOnly?: boolean;
}

// Цветовые схемы для темной и светлой темы
const getThemeColors = (isDark: boolean) => ({
  drawerBg: isDark ? '#101114' : '#ffffff',
  drawerBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  borderLight: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
  titleText: isDark ? '#f0f0f0' : '#1a1a1a',
  normalText: isDark ? '#ccc' : '#333',
  secondaryText: isDark ? '#ddd' : '#555',
  labelText: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.45)',
  mutedText: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.35)',
  veryMutedText: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)',
  fieldBg: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)',
  fieldBorder: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)',
  itemBorder: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)',
  tabInactive: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.45)',
  cancelBtnBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
  cancelBtnBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
  cancelBtnText: isDark ? '#fff' : '#666',
  iconColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
});

// Компонент для редактирования элемента хронологии
interface ChronologyItemEditProps {
  event: any;
  index: number;
  onUpdate: (updatedItems: any[]) => Promise<void>;
  allItems: any[];
  isDark: boolean;
  readOnly?: boolean;
}

const ChronologyItemEdit: React.FC<ChronologyItemEditProps> = ({ event, index, onUpdate, allItems, isDark, readOnly = false }) => {
  const colors = getThemeColors(isDark);
  // Автоматически открывать редактирование для новых элементов (с пустым текстом)
  const [isEditing, setIsEditing] = useState(event.text === '');
  const [editDate, setEditDate] = useState<dayjs.Dayjs | null>(
    event.date ? dayjs(event.date) : null
  );
  const [editText, setEditText] = useState(event.text);

  // Обновить локальное состояние при изменении события (после refetch)
  useEffect(() => {
    setEditDate(event.date ? dayjs(event.date) : null);
    setEditText(event.text);
  }, [event.date, event.text]);

  const handleSave = async () => {
    if (!editText.trim()) {
      return; // Не сохранять пустые записи
    }
    const updatedItems = [...allItems];
    updatedItems[index] = {
      date: editDate ? editDate.toISOString() : null,
      text: editText,
    };
    await onUpdate(updatedItems);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const updatedItems = allItems.filter((_: any, idx: number) => idx !== index);
    await onUpdate(updatedItems);
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 9,
        background: colors.fieldBg,
        border: `1px solid ${colors.itemBorder}`,
      }}
    >
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DatePicker
            value={editDate}
            onChange={setEditDate}
            format="DD.MM.YYYY"
            style={{ width: '100%' }}
            placeholder="Дата события"
          />
          <Input.TextArea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Описание события"
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="small" type="primary" onClick={handleSave}>
              Сохранить
            </Button>
            <Button size="small" onClick={() => setIsEditing(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: colors.labelText,
                fontFamily: "'DM Mono', monospace",
                marginBottom: 2,
              }}
            >
              {event.date ? dayjs(event.date).format('DD.MM.YYYY') : 'Без даты'}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: colors.secondaryText,
                fontWeight: 500,
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              {event.text}
            </div>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                style={{ color: '#34d399' }}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент для редактирования элемента тендерного пакета
interface PackageItemEditProps {
  file: any;
  index: number;
  onUpdate: (updatedItems: any[]) => Promise<void>;
  allItems: any[];
  isDark: boolean;
  readOnly?: boolean;
}

const PackageItemEdit: React.FC<PackageItemEditProps> = ({ file, index, onUpdate, allItems, isDark, readOnly = false }) => {
  const colors = getThemeColors(isDark);
  // Автоматически открывать редактирование для новых элементов (с пустым текстом)
  const [isEditing, setIsEditing] = useState(file.text === '');
  const [editDate, setEditDate] = useState<dayjs.Dayjs | null>(
    file.date ? dayjs(file.date) : null
  );
  const [editText, setEditText] = useState(file.text);

  // Обновить локальное состояние при изменении файла (после refetch)
  useEffect(() => {
    setEditDate(file.date ? dayjs(file.date) : null);
    setEditText(file.text);
  }, [file.date, file.text]);

  const handleSave = async () => {
    if (!editText.trim()) {
      return; // Не сохранять пустые записи
    }
    const updatedItems = [...allItems];
    updatedItems[index] = {
      date: editDate ? editDate.toISOString() : null,
      text: editText,
    };
    await onUpdate(updatedItems);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const updatedItems = allItems.filter((_: any, idx: number) => idx !== index);
    await onUpdate(updatedItems);
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 9,
        background: colors.fieldBg,
        border: `1px solid ${colors.itemBorder}`,
      }}
    >
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DatePicker
            value={editDate}
            onChange={setEditDate}
            format="DD.MM.YYYY"
            style={{ width: '100%' }}
            placeholder="Дата документа"
          />
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Название документа"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="small" type="primary" onClick={handleSave}>
              Сохранить
            </Button>
            <Button size="small" onClick={() => setIsEditing(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: colors.secondaryText,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.text}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: colors.mutedText,
                fontFamily: "'DM Mono', monospace",
                marginTop: 1,
              }}
            >
              {file.date ? dayjs(file.date).format('DD.MM.YYYY') : 'Без даты'}
            </div>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                style={{ color: '#34d399' }}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент редактируемого поля
interface EditableFieldProps {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
  onSave: (newValue: string) => Promise<void>;
  multiline?: boolean;
  isDark: boolean;
  readOnly?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ icon, label, value, onSave, multiline = false, isDark, readOnly = false }) => {
  const colors = getThemeColors(isDark);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [hovered, setHovered] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      message.success('Обновлено');
    } catch (error) {
      message.error('Ошибка обновления');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: 9,
        padding: '9px 11px',
        borderRadius: 8,
        background: colors.fieldBg,
        border: `1px solid ${colors.fieldBorder}`,
        position: 'relative',
      }}
    >
      {icon && (
        <div style={{ color: colors.iconColor, marginTop: 2, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: colors.labelText,
            marginBottom: 2,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {label}
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {multiline ? (
              <Input.TextArea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onPressEnter={handleSave}
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ fontSize: 13, flex: 1 }}
                autoFocus
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onPressEnter={handleSave}
                style={{ fontSize: 13, flex: 1 }}
                autoFocus
              />
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#34d399',
                border: 'none',
                borderRadius: 5,
                padding: '4px 10px',
                color: '#000',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓
            </button>
            <button
              onClick={handleCancel}
              style={{
                background: colors.cancelBtnBg,
                border: `1px solid ${colors.cancelBtnBorder}`,
                borderRadius: 5,
                padding: '4px 10px',
                color: colors.cancelBtnText,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: colors.normalText, fontWeight: 400 }}>
            {value || '—'}
          </div>
        )}
      </div>
      {!isEditing && !readOnly && (
        <button
          onClick={() => setIsEditing(true)}
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.15)',
            borderRadius: 5,
            width: 26,
            height: 26,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34d399',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <EditOutlined style={{ fontSize: 13 }} />
        </button>
      )}
    </div>
  );
};

// Компонент редактируемой даты
interface EditableDateFieldProps {
  label: string;
  value: string | null | undefined;
  onSave: (newValue: string | null) => Promise<void>;
  isDark: boolean;
  readOnly?: boolean;
}

const EditableDateField: React.FC<EditableDateFieldProps> = ({ label, value, onSave, isDark, readOnly = false }) => {
  const colors = getThemeColors(isDark);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<dayjs.Dayjs | null>(value ? dayjs(value) : null);
  const [hovered, setHovered] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditValue(value ? dayjs(value) : null);
  }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue ? editValue.toISOString() : null);
      setIsEditing(false);
      message.success('Дата обновлена');
    } catch (error) {
      message.error('Ошибка обновления');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value ? dayjs(value) : null);
    setIsEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px 11px',
        borderRadius: 8,
        background: colors.fieldBg,
        border: `1px solid ${colors.fieldBorder}`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: colors.labelText,
              marginBottom: 3,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {label}
          </div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <DatePicker
                value={editValue}
                onChange={setEditValue}
                format="DD.MM.YYYY"
                style={{ width: '100%' }}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: '#34d399',
                  border: 'none',
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: '#000',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                style={{
                  background: colors.cancelBtnBg,
                  border: `1px solid ${colors.cancelBtnBorder}`,
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: colors.cancelBtnText,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: value ? colors.normalText : colors.veryMutedText,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              <CalendarOutlined style={{ color: colors.veryMutedText }} />
              {value ? dayjs(value).format('DD.MM.YYYY') : '—'}
            </div>
          )}
        </div>
        {!isEditing && !readOnly && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.15)',
              borderRadius: 5,
              width: 22,
              height: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              flexShrink: 0,
            }}
          >
            <EditOutlined style={{ fontSize: 11 }} />
          </button>
        )}
      </div>
    </div>
  );
};

// Компонент редактируемого Select поля
interface EditableSelectFieldProps {
  label: string;
  value: string | null | undefined;
  options: { id: string; name: string }[];
  onSave: (newValue: string | null) => Promise<void>;
  isDark: boolean;
  readOnly?: boolean;
}

const EditableSelectField: React.FC<EditableSelectFieldProps> = ({ label, value, options, onSave, isDark, readOnly = false }) => {
  const colors = getThemeColors(isDark);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string | null>(value || null);
  const [hovered, setHovered] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditValue(value || null);
  }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      message.success('Обновлено');
    } catch (error) {
      message.error('Ошибка обновления');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || null);
    setIsEditing(false);
  };

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px 11px',
        borderRadius: 8,
        background: colors.fieldBg,
        border: `1px solid ${colors.fieldBorder}`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: colors.labelText,
              marginBottom: 3,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {label}
          </div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Select
                value={editValue}
                onChange={setEditValue}
                style={{ width: '100%' }}
                autoFocus
                allowClear
                placeholder="Выберите значение"
              >
                {options.map(opt => (
                  <Select.Option key={opt.id} value={opt.id}>
                    {opt.name}
                  </Select.Option>
                ))}
              </Select>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: '#34d399',
                  border: 'none',
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: '#000',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                style={{
                  background: colors.cancelBtnBg,
                  border: `1px solid ${colors.cancelBtnBorder}`,
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: colors.cancelBtnText,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: colors.normalText,
                fontWeight: 400,
              }}
            >
              {selectedOption?.name || '—'}
            </div>
          )}
        </div>
        {!isEditing && !readOnly && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.15)',
              borderRadius: 5,
              width: 22,
              height: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              flexShrink: 0,
            }}
          >
            <EditOutlined style={{ fontSize: 11 }} />
          </button>
        )}
      </div>
    </div>
  );
};

export const TenderDrawerModern: React.FC<TenderDrawerModernProps> = ({
  open,
  tender,
  statuses,
  constructionScopes,
  onClose,
  onUpdate,
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);
  const [activeTab, setActiveTab] = useState('info');
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  useEffect(() => {
    if (tender) {
      setActiveTab('info');
      setIsEditingPhoto(false);
      setPhotoUrl(tender.site_visit_photo_url || '');
    }
  }, [tender?.id]);

  if (!tender) return null;

  const updateField = async (field: string, value: any) => {
    const { error } = await supabase
      .from('tender_registry')
      .update({ [field]: value })
      .eq('id', tender.id);

    if (!error) {
      onUpdate();
    } else {
      throw error;
    }
  };

  const handleSavePhoto = async () => {
    setSavingPhoto(true);
    try {
      await updateField('site_visit_photo_url', photoUrl);
      setIsEditingPhoto(false);
      message.success('Обновлено');
    } catch (error) {
      message.error('Ошибка обновления');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleCancelPhoto = () => {
    setPhotoUrl(tender.site_visit_photo_url || '');
    setIsEditingPhoto(false);
  };

  const statusBadge = getStatusBadge((tender.status as any)?.name);
  const chronologyItems = (tender.chronology_items as any[]) || [];
  const packageItems = (tender.tender_package_items as any[]) || [];

  return (
    <div
      className="tender-drawer-hidden-scroll"
      style={{
        width: open ? 460 : 0,
        height: '100vh',
        overflow: open ? 'auto' : 'hidden',
        background: colors.drawerBg,
        borderLeft: open ? `1px solid ${colors.drawerBorder}` : 'none',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 22px 0',
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: colors.titleText,
                fontFamily: "'Manrope', sans-serif",
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {tender.title}
            </h2>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: statusBadge.bg,
                  color: statusBadge.text,
                  border: `1px solid ${statusBadge.border}`,
                  borderRadius: 16,
                  padding: '3px 10px 3px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: statusBadge.text,
                  }}
                />
                {(tender.status as any)?.name || 'Неизвестно'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tender-drawer-hidden-scroll" style={{ display: 'flex', marginTop: 4, overflowX: 'auto' }}>
          {[
            { id: 'info', label: 'Информация' },
            { id: 'timeline', label: 'Хронология' },
            { id: 'package', label: 'Тендерный пакет' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab.id ? '#34d399' : colors.tabInactive,
                fontSize: 12,
                fontWeight: 500,
                padding: '8px 13px',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #34d399' : '2px solid transparent',
                transition: 'all 0.15s',
                fontFamily: "'Manrope', sans-serif",
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
        {activeTab === 'info' && (
          <>
            <div
              style={{
                fontSize: 10,
                color: colors.mutedText,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: "'DM Mono', monospace",
                marginBottom: 8,
              }}
            >
              Объект
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
              <EditableField
                label="Номер тендера"
                value={tender.tender_number}
                onSave={(v) => updateField('tender_number', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableField
                label="Наименование"
                value={tender.title}
                onSave={(v) => updateField('title', v)}
                multiline
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableField
                label="Заказчик"
                value={tender.client_name}
                onSave={(v) => updateField('client_name', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableField
                label="Площадь"
                value={tender.area ? `${tender.area.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} м²` : null}
                onSave={async (v) => {
                  const num = parseFloat(v.replace(/[^\d.]/g, ''));
                  await updateField('area', isNaN(num) ? null : num);
                }}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableField
                label="Адрес"
                value={tender.object_address}
                onSave={(v) => updateField('object_address', v)}
                multiline
                isDark={isDark}
                readOnly={readOnly}
              />

              <EditableSelectField
                label="Объем строительства"
                value={tender.construction_scope_id}
                options={constructionScopes}
                onSave={(v) => updateField('construction_scope_id', v)}
                isDark={isDark}
                readOnly={readOnly}
              />

              <EditableField
                label="Общая стоимость (ручной ввод)"
                value={
                  tender.manual_total_cost != null
                    ? tender.manual_total_cost.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : tender.total_cost != null
                    ? `${tender.total_cost.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (авто)`
                    : null
                }
                onSave={async (v) => {
                  // Парсим число из строки с пробелами и запятыми (например "1 000 000" или "123456")
                  const numStr = v.replace(/\s/g, '').replace(',', '.');
                  const num = parseFloat(numStr);
                  const rubValue = isNaN(num) ? null : num;
                  await updateField('manual_total_cost', rubValue);
                }}
                isDark={isDark}
                readOnly={readOnly}
              />
            </div>

            <div
              style={{
                fontSize: 10,
                color: colors.mutedText,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: "'DM Mono', monospace",
                marginBottom: 8,
              }}
            >
              Фото посещения
            </div>
            <div style={{ marginBottom: 22 }}>
              {isEditingPhoto ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: colors.labelText,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontFamily: "'DM Mono', monospace",
                      marginBottom: 6,
                    }}
                  >
                    Ссылка на фото посещения площадки
                  </div>
                  <Input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    style={{
                      marginBottom: 8,
                      background: colors.fieldBg,
                      borderColor: colors.fieldBorder,
                      color: colors.normalText,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="small"
                      type="primary"
                      onClick={handleSavePhoto}
                      loading={savingPhoto}
                      style={{
                        background: '#34d399',
                        borderColor: '#34d399',
                      }}
                    >
                      Сохранить
                    </Button>
                    <Button
                      size="small"
                      onClick={handleCancelPhoto}
                      style={{
                        background: colors.cancelBtnBg,
                        borderColor: colors.cancelBtnBorder,
                        color: colors.cancelBtnText,
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : tender.site_visit_photo_url ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <a
                    href={tender.site_visit_photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13,
                      color: '#34d399',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Открыть фото
                  </a>
                  {!readOnly && (
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setIsEditingPhoto(true)}
                      style={{ color: '#34d399' }}
                    />
                  )}
                </div>
              ) : !readOnly ? (
                <div>
                  <Button
                    size="small"
                    type="dashed"
                    onClick={() => setIsEditingPhoto(true)}
                    style={{
                      color: colors.mutedText,
                      borderColor: colors.fieldBorder,
                    }}
                  >
                    + Добавить ссылку на фото
                  </Button>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: colors.mutedText }}>—</div>
              )}
            </div>

            <div
              style={{
                fontSize: 10,
                color: colors.mutedText,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: "'DM Mono', monospace",
                marginBottom: 8,
              }}
            >
              Ключевые даты
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <EditableDateField
                label="Приглашение"
                value={tender.invitation_date}
                onSave={(v) => updateField('invitation_date', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableDateField
                label="Посещение площадки"
                value={tender.site_visit_date}
                onSave={(v) => updateField('site_visit_date', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableDateField
                label="Подача КП"
                value={tender.submission_date}
                onSave={(v) => updateField('submission_date', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
              <EditableDateField
                label="Дата выхода на площадку"
                value={tender.construction_start_date}
                onSave={(v) => updateField('construction_start_date', v)}
                isDark={isDark}
                readOnly={readOnly}
              />
            </div>
          </>
        )}

        {activeTab === 'timeline' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chronologyItems.map((event: any, i: number) => (
                <ChronologyItemEdit
                  key={i}
                  event={event}
                  index={i}
                  allItems={chronologyItems}
                  onUpdate={(items) => updateField('chronology_items', items)}
                  isDark={isDark}
                  readOnly={readOnly}
                />
              ))}
            </div>
            {!readOnly && (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                block
                style={{ marginTop: 12 }}
                onClick={async () => {
                  const newItem = { date: null, text: '' };
                  const updatedItems = [...chronologyItems, newItem];
                  await updateField('chronology_items', updatedItems);
                }}
              >
                Добавить событие
              </Button>
            )}
          </div>
        )}

        {activeTab === 'package' && (
          <div>
            <p style={{ fontSize: 12, color: colors.mutedText, marginBottom: 14 }}>
              Документы тендерного пакета от заказчика
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {packageItems.map((file: any, i: number) => (
                <PackageItemEdit
                  key={i}
                  file={file}
                  index={i}
                  allItems={packageItems}
                  onUpdate={(items) => updateField('tender_package_items', items)}
                  isDark={isDark}
                  readOnly={readOnly}
                />
              ))}
            </div>
            {!readOnly && (
              <Button
              type="dashed"
              icon={<PlusOutlined />}
              block
              style={{ marginTop: 12 }}
              onClick={async () => {
                const newItem = { date: null, text: '' };
                const updatedItems = [...packageItems, newItem];
                await updateField('tender_package_items', updatedItems);
              }}
            >
              Добавить информацию
            </Button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
