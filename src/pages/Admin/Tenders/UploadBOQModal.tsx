import React, { useState, useEffect } from 'react';
import {
  Modal,
  Upload,
  Button,
  message,
  Alert,
  Space,
  Typography,
  Progress,
  List,
  Table,
  Select,
  Input,
  Form,
  Collapse,
  theme
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  PlusOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { supabase, type ClientPositionInsert } from '../../../lib/supabase';

const { Text } = Typography;
const { Dragger } = Upload;
const { Panel } = Collapse;

interface UploadBOQModalProps {
  visible: boolean;
  tenderId: string;
  tenderName: string;
  onCancel: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  item_no: string;
  hierarchy_level: number;
  work_name: string;
  unit_code: string;
  volume: number;
  client_note: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  unknownUnits: string[];
}

interface ExistingUnit {
  code: string;
  name: string;
  description?: string;
}

interface UnitMapping {
  originalCode: string;
  mappedCode: string | null;
  action: 'map' | 'create' | 'skip';
}

const UploadBOQModal: React.FC<UploadBOQModalProps> = ({
  visible,
  tenderId,
  tenderName,
  onCancel,
  onSuccess,
}) => {
  const { token } = theme.useToken();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingUnits, setExistingUnits] = useState<ExistingUnit[]>([]);
  const [unitMappings, setUnitMappings] = useState<UnitMapping[]>([]);
  const [newUnitForm] = Form.useForm();

  // Загрузка существующих единиц измерения из БД
  useEffect(() => {
    if (visible) {
      fetchExistingUnits();
    }
  }, [visible]);

  const fetchExistingUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('code, name, description')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Ошибка загрузки единиц измерения:', error);
        message.error('Не удалось загрузить единицы измерения');
      } else if (data) {
        setExistingUnits(data);
      }
    } catch (error) {
      console.error('Ошибка при загрузке единиц:', error);
    }
  };

  // Проверка существования единицы измерения
  const isUnitExists = (unit: string): boolean => {
    return existingUnits.some(u => u.code === unit);
  };

  // Валидация распарсенных данных
  const validateData = (data: ParsedRow[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const unknownUnitsSet = new Set<string>();

    if (data.length === 0) {
      errors.push('Файл не содержит данных');
      return { isValid: false, errors, warnings, unknownUnits: [] };
    }

    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 потому что 1 строка - заголовки, и индекс с 0

      // Проверка обязательных полей
      if (!row.work_name || row.work_name.trim() === '') {
        errors.push(`Строка ${rowNum}: отсутствует название работы`);
      }

      // Проверка единицы измерения
      if (row.unit_code) {
        if (!isUnitExists(row.unit_code)) {
          unknownUnitsSet.add(row.unit_code);
          warnings.push(`Строка ${rowNum}: неизвестная единица измерения "${row.unit_code}"`);
        }
      }

      // Проверка объема
      if (row.volume && (isNaN(row.volume) || row.volume < 0)) {
        errors.push(`Строка ${rowNum}: некорректный объем "${row.volume}"`);
      }

      // Проверка уровня иерархии
      if (row.hierarchy_level && (isNaN(row.hierarchy_level) || row.hierarchy_level < 0)) {
        errors.push(`Строка ${rowNum}: некорректный уровень иерархии "${row.hierarchy_level}"`);
      }
    });

    const unknownUnits = Array.from(unknownUnitsSet);

    // Инициализация маппингов для неизвестных единиц
    if (unknownUnits.length > 0) {
      setUnitMappings(unknownUnits.map(code => ({
        originalCode: code,
        mappedCode: null,
        action: 'map'
      })));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      unknownUnits
    };
  };

  // Парсинг Excel файла
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Берем первый лист
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });

        // Пропускаем первую строку (заголовки)
        const rows = jsonData.slice(1);

        const parsed: ParsedRow[] = rows
          .filter((row: unknown) => Array.isArray(row) && row.length > 0 && row.some(cell => cell !== undefined && cell !== ''))
          .map((row: unknown) => {
            const cells = row as unknown[];
            return {
              item_no: cells[0] ? String(cells[0]).trim() : '',
              hierarchy_level: cells[1] ? Number(cells[1]) : 0,
              work_name: cells[2] ? String(cells[2]).trim() : '',
              unit_code: cells[3] ? String(cells[3]).trim() : '',
              volume: cells[4] ? Number(cells[4]) : 0,
              client_note: cells[5] ? String(cells[5]).trim() : '',
            };
          });

        setParsedData(parsed);

        // Валидация
        const validation = validateData(parsed);
        setValidationResult(validation);

        if (validation.isValid && validation.unknownUnits.length === 0) {
          message.success(`Файл успешно обработан: ${parsed.length} позиций`);
        } else if (validation.unknownUnits.length > 0) {
          message.warning(`Файл обработан, но найдены неизвестные единицы измерения. Настройте маппинг.`);
        } else {
          message.error('Обнаружены ошибки в данных');
        }
      } catch (error) {
        console.error('Ошибка парсинга Excel:', error);
        message.error('Ошибка при чтении файла');
        setValidationResult({
          isValid: false,
          errors: ['Не удалось прочитать файл. Проверьте формат.'],
          warnings: [],
          unknownUnits: []
        });
      }
    };

    reader.readAsBinaryString(file);
    return false; // Предотвращаем автоматическую загрузку
  };

  // Обновление маппинга единицы измерения
  const handleMappingChange = (originalCode: string, value: string, action: 'map' | 'create') => {
    setUnitMappings(prev => prev.map(m =>
      m.originalCode === originalCode
        ? { ...m, mappedCode: value, action }
        : m
    ));
  };

  // Создание новой единицы измерения
  const handleCreateUnit = async (originalCode: string) => {
    try {
      const values = await newUnitForm.validateFields();

      const { error } = await supabase
        .from('units')
        .insert([{
          code: originalCode,
          name: values.name || originalCode,
          description: values.description || null,
          is_active: true,
          sort_order: 999
        }]);

      if (error) {
        console.error('Ошибка создания единицы:', error);
        message.error(`Ошибка при создании единицы: ${error.message}`);
      } else {
        message.success(`Единица "${originalCode}" успешно создана`);
        // Перезагрузка списка единиц
        await fetchExistingUnits();
        // Обновляем маппинг
        handleMappingChange(originalCode, originalCode, 'map');
        newUnitForm.resetFields();
      }
    } catch (error) {
      console.error('Ошибка валидации формы:', error);
    }
  };

  // Проверка готовности к загрузке
  const isReadyForUpload = (): boolean => {
    if (!validationResult?.isValid || parsedData.length === 0) {
      return false;
    }

    // Проверяем, что все неизвестные единицы обработаны
    if (validationResult.unknownUnits.length > 0) {
      return unitMappings.every(m => m.mappedCode !== null);
    }

    return true;
  };

  // Получение финального кода единицы измерения с учетом маппинга
  const getFinalUnitCode = (originalCode: string) => {
    if (!originalCode) return undefined;

    if (isUnitExists(originalCode)) {
      return originalCode;
    }

    const mapping = unitMappings.find(m => m.originalCode === originalCode);
    return mapping?.mappedCode || undefined;
  };

  // Сохранение данных в БД
  const handleUpload = async () => {
    if (!isReadyForUpload()) {
      message.error('Необходимо настроить маппинг для всех неизвестных единиц');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Формируем данные для вставки с учетом маппинга
      const positions: ClientPositionInsert[] = parsedData.map((row, index) => ({
        tender_id: tenderId,
        position_number: index + 1,
        unit_code: getFinalUnitCode(row.unit_code),
        volume: row.volume || undefined,
        client_note: row.client_note || undefined,
        item_no: row.item_no || undefined,
        work_name: row.work_name,
        hierarchy_level: row.hierarchy_level || 0,
        is_additional: false,
        manual_volume: undefined,
        manual_note: undefined,
        parent_position_id: undefined,
        total_material: 0,
        total_works: 0,
        material_cost_per_unit: 0,
        work_cost_per_unit: 0,
        total_commercial_material: 0,
        total_commercial_work: 0,
        total_commercial_material_per_unit: 0,
        total_commercial_work_per_unit: 0,
      }));

      // Вставка данных порциями (по 100 записей)
      const batchSize = 100;
      const totalBatches = Math.ceil(positions.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const batch = positions.slice(i * batchSize, (i + 1) * batchSize);

        const { error } = await supabase
          .from('client_positions')
          .insert(batch);

        if (error) {
          console.error('Ошибка вставки данных:', error);
          throw new Error(`Ошибка при сохранении данных: ${error.message}`);
        }

        // Обновляем прогресс
        setUploadProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      message.success(`Успешно загружено ${positions.length} позиций`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при загрузке данных';
      message.error(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Закрытие модального окна
  const handleClose = () => {
    setFileList([]);
    setParsedData([]);
    setValidationResult(null);
    setUploadProgress(0);
    setUnitMappings([]);
    newUnitForm.resetFields();
    onCancel();
  };

  // Колонки для таблицы маппинга единиц
  const mappingColumns: ColumnsType<UnitMapping> = [
    {
      title: 'Исходная единица',
      dataIndex: 'originalCode',
      key: 'originalCode',
      width: 150,
      render: (code: string) => <Text strong code>{code}</Text>
    },
    {
      title: 'Сопоставить с',
      key: 'mapping',
      render: (_: unknown, record: UnitMapping) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите существующую единицу"
            value={record.action === 'map' ? record.mappedCode : undefined}
            onChange={(value) => handleMappingChange(record.originalCode, value, 'map')}
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={existingUnits.map(u => ({
              value: u.code,
              label: `${u.code} - ${u.name}`
            }))}
          />
          <Space>
            <Button
              size="small"
              type={record.action === 'create' ? 'primary' : 'default'}
              icon={<PlusOutlined />}
              onClick={() => handleMappingChange(record.originalCode, record.originalCode, 'create')}
            >
              Создать новую
            </Button>
            {record.action === 'create' && (
              <Button
                size="small"
                onClick={() => handleMappingChange(record.originalCode, '', 'map')}
              >
                Отмена
              </Button>
            )}
          </Space>
          {record.action === 'create' && (
            <Form
              form={newUnitForm}
              layout="vertical"
              size="small"
              style={{
                marginTop: 8,
                padding: 12,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadius
              }}
            >
              <Form.Item
                label="Код единицы"
                help={`Будет использован код: ${record.originalCode}`}
              >
                <Input value={record.originalCode} disabled />
              </Form.Item>
              <Form.Item
                name="name"
                label="Полное наименование"
                rules={[{ required: true, message: 'Введите наименование' }]}
              >
                <Input placeholder="Например: штуки, метры и т.д." />
              </Form.Item>
              <Form.Item
                name="description"
                label="Описание (опционально)"
              >
                <Input.TextArea rows={2} placeholder="Дополнительная информация" />
              </Form.Item>
              <Button
                type="primary"
                size="small"
                onClick={() => handleCreateUnit(record.originalCode)}
              >
                Сохранить единицу
              </Button>
            </Form>
          )}
        </Space>
      )
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined style={{ color: '#10b981' }} />
          <span>Загрузка ВОРа заказчика</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={uploading}>
          Отмена
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={!isReadyForUpload()}
          icon={<UploadOutlined />}
        >
          {uploading ? 'Загрузка...' : 'Загрузить в БД'}
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Информация о тендере */}
        <Alert
          message={<Text strong>Тендер: {tenderName}</Text>}
          type="info"
          showIcon
        />

        {/* Инструкция по формату файла */}
        <Alert
          message="Формат Excel файла"
          description={
            <List size="small" style={{ marginTop: 8 }}>
              <List.Item>
                <Text>1-й столбец: <Text code>Номер раздела</Text> (item_no)</Text>
              </List.Item>
              <List.Item>
                <Text>2-й столбец: <Text code>Уровень иерархии</Text> (число, например: 0, 1, 2)</Text>
              </List.Item>
              <List.Item>
                <Text>3-й столбец: <Text code>Название работы</Text> (обязательное)</Text>
              </List.Item>
              <List.Item>
                <Text>4-й столбец: <Text code>Единица измерения</Text> (код единицы)</Text>
              </List.Item>
              <List.Item>
                <Text>5-й столбец: <Text code>Объем</Text> (число)</Text>
              </List.Item>
              <List.Item>
                <Text>6-й столбец: <Text code>Примечание</Text> (текст)</Text>
              </List.Item>
            </List>
          }
          type="warning"
        />

        {/* Загрузчик файла */}
        <Dragger
          fileList={fileList}
          beforeUpload={handleFileUpload}
          onChange={(info) => setFileList(info.fileList.slice(-1))}
          onRemove={() => {
            setFileList([]);
            setParsedData([]);
            setValidationResult(null);
            setUnitMappings([]);
          }}
          accept=".xlsx,.xls"
          maxCount={1}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <FileExcelOutlined style={{ color: '#10b981' }} />
          </p>
          <p className="ant-upload-text">Нажмите или перетащите Excel файл</p>
          <p className="ant-upload-hint">
            Поддерживаются форматы: .xlsx, .xls
          </p>
        </Dragger>

        {/* Маппинг неизвестных единиц измерения */}
        {validationResult && validationResult.unknownUnits.length > 0 && (
          <Collapse defaultActiveKey={['1']}>
            <Panel
              header={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <Text strong>
                    Требуется настроить {validationResult.unknownUnits.length} единиц измерения
                  </Text>
                </Space>
              }
              key="1"
            >
              <Alert
                message="Обнаружены неизвестные единицы измерения"
                description="Для каждой единицы выберите существующую из списка или создайте новую"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table
                columns={mappingColumns}
                dataSource={unitMappings}
                rowKey="originalCode"
                pagination={false}
                size="small"
              />
            </Panel>
          </Collapse>
        )}

        {/* Результаты валидации */}
        {validationResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {validationResult.isValid && validationResult.unknownUnits.length === 0 && (
              <Alert
                message={
                  <Space>
                    <CheckCircleOutlined />
                    <Text>Данные валидны. Готово к загрузке: {parsedData.length} позиций</Text>
                  </Space>
                }
                type="success"
                showIcon
              />
            )}

            {validationResult.errors.length > 0 && (
              <Alert
                message={<Text strong>Ошибки ({validationResult.errors.length})</Text>}
                description={
                  <List
                    size="small"
                    dataSource={validationResult.errors.slice(0, 5)}
                    renderItem={(error) => (
                      <List.Item>
                        <CloseCircleOutlined style={{ color: '#f44336', marginRight: 8 }} />
                        <Text type="danger">{error}</Text>
                      </List.Item>
                    )}
                    footer={
                      validationResult.errors.length > 5 && (
                        <Text type="secondary">
                          ...и еще {validationResult.errors.length - 5} ошибок
                        </Text>
                      )
                    }
                  />
                }
                type="error"
                showIcon
              />
            )}
          </Space>
        )}

        {/* Прогресс загрузки */}
        {uploading && (
          <Progress percent={uploadProgress} status="active" />
        )}
      </Space>
    </Modal>
  );
};

export default UploadBOQModal;
