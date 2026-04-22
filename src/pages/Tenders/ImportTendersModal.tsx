import React, { useMemo, useState } from 'react';
import { Alert, Modal, Table, Tag, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  supabase,
  type ChronologyItem,
  type ConstructionScope,
  type DashboardStatus,
  type TenderPackageItem,
  type TenderRegistryInsert,
  type TenderRegistryWithRelations,
  type TenderStatus,
} from '../../lib/supabase';
import { getDashboardStatusByStatusName, parseMoneyInput, sortChronologyItems } from './utils/tenderMonitor';

const { Text } = Typography;

type SupportedImportField =
  | 'tender_number'
  | 'title'
  | 'client_name'
  | 'object_address'
  | 'object_coordinates'
  | 'construction_scope'
  | 'area'
  | 'manual_total_cost'
  | 'submission_date'
  | 'chronology'
  | 'construction_start_date'
  | 'site_visit_date'
  | 'site_visit_photo_url'
  | 'tender_package'
  | 'invitation_date'
  | 'status'
  | 'commission_date';

interface ImportTendersModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  constructionScopes: ConstructionScope[];
  statuses: TenderStatus[];
}

interface ImportedTenderRow {
  tender_number?: string;
  title?: string;
  client_name?: string;
  object_address?: string;
  object_coordinates?: string;
  construction_scope?: string;
  area?: number;
  manual_total_cost?: number;
  submission_date?: string;
  chronology_items: ChronologyItem[];
  construction_start_date?: string;
  site_visit_date?: string;
  site_visit_photo_url?: string;
  tender_package_items: TenderPackageItem[];
  invitation_date?: string;
  status?: string;
  commission_date?: string;
}

interface ImportPreviewRow extends ImportedTenderRow {
  rowNumber: number;
  action: 'create' | 'update' | 'skip';
  matchedTenderId?: string;
  matchedBy?: string;
  warnings: string[];
  payload?: TenderRegistryInsert;
}

interface ExistingTenderLite
  extends Pick<
    TenderRegistryWithRelations,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'tender_number'
    | 'title'
    | 'client_name'
    | 'object_address'
    | 'object_coordinates'
    | 'construction_scope_id'
    | 'area'
    | 'manual_total_cost'
    | 'submission_date'
    | 'chronology_items'
    | 'construction_start_date'
    | 'site_visit_date'
    | 'site_visit_photo_url'
    | 'tender_package_items'
    | 'invitation_date'
    | 'status_id'
    | 'commission_date'
    | 'dashboard_status'
    | 'is_archived'
    | 'sort_order'
  > {}

const FIELD_ALIASES: Record<SupportedImportField, string[]> = {
  tender_number: ['Номер тендера', 'Номер'],
  title: ['Наименование ЖК', 'Наименование', 'Название тендера', 'Тендер'],
  client_name: ['Заказчик', 'Наименование заказчика'],
  object_address: ['Адрес объекта', 'Адрес'],
  object_coordinates: ['Координаты объекта', 'Координаты'],
  construction_scope: ['Работа', 'Объем строительства', 'Объём строительства'],
  area: ['Площадь по СП, м2', 'Площадь по СП м2', 'Площадь, м2', 'Площадь по СП', 'Площадь'],
  manual_total_cost: [
    'Стоимость КП',
    'Стоимость КП, руб',
    'Стоимость КП, ₽',
    'Сумма КП',
    'Сумма КП, руб',
    'Сумма КП, ₽',
    'Общая стоимость КП',
    'Общая стоимость КП, руб',
    'Общая стоимость КП, ₽',
    'Стоимость',
    'Сумма',
  ],
  submission_date: ['Дата подачи КП', 'Срок подачи КП'],
  chronology: ['Хронологии тендеров (дата выхода на площадку)', 'Хронология'],
  construction_start_date: ['Дата выхода на строительную площадку', 'Дата выхода на площадку', 'Дата выхода'],
  site_visit_date: ['Дата посещения площадки', 'Дата выезда на площадку'],
  site_visit_photo_url: ['Фото посещения площадки', 'Ссылка на фото посещения', 'Фото площадки'],
  tender_package: ['Наличие тендерного пакета', 'Тендерный пакет', 'Состав тендерного пакета'],
  invitation_date: ['Когда поступило приглашение', 'Дата приглашения'],
  status: ['Статус'],
  commission_date: ['Ввод в эксплуатацию', 'Дата ввода в эксплуатацию'],
};

const SUPPORTED_FIELDS = Object.keys(FIELD_ALIASES) as SupportedImportField[];

const DATE_FORMATS: string[] = [
  'DD.MM.YYYY HH:mm',
  'D.M.YYYY HH:mm',
  'DD.MM.YYYY',
  'D.M.YYYY',
  'DD/MM/YYYY',
  'D/M/YYYY',
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD',
];

const PREVIEW_COLUMNS = [
  {
    title: 'Действие',
    key: 'action',
    fixed: 'left' as const,
    width: 118,
    render: (_: unknown, row: ImportPreviewRow) => {
      if (row.action === 'skip') {
        return <Tag color="error">Пропуск</Tag>;
      }
      if (row.action === 'update') {
        return <Tag color="processing">Обновление</Tag>;
      }
      return <Tag color="success">Создание</Tag>;
    },
  },
  {
    title: 'Сопоставление',
    key: 'matchedBy',
    width: 150,
    render: (_: unknown, row: ImportPreviewRow) => row.matchedBy || '-',
  },
  {
    title: 'Номер тендера',
    dataIndex: 'tender_number',
    key: 'tender_number',
    width: 140,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Наименование',
    dataIndex: 'title',
    key: 'title',
    width: 220,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Заказчик',
    dataIndex: 'client_name',
    key: 'client_name',
    width: 180,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Адрес объекта',
    dataIndex: 'object_address',
    key: 'object_address',
    width: 220,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Координаты',
    dataIndex: 'object_coordinates',
    key: 'object_coordinates',
    width: 170,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Объем строительства',
    dataIndex: 'construction_scope',
    key: 'construction_scope',
    width: 180,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Площадь, м2',
    dataIndex: 'area',
    key: 'area',
    width: 110,
    render: (value: number | undefined) => (value != null ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '-'),
  },
  {
    title: 'Стоимость КП',
    dataIndex: 'manual_total_cost',
    key: 'manual_total_cost',
    width: 130,
    render: (value: number | undefined) => (value != null ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '-'),
  },
  {
    title: 'Статус',
    dataIndex: 'status',
    key: 'status',
    width: 170,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Дата подачи КП',
    dataIndex: 'submission_date',
    key: 'submission_date',
    width: 130,
    render: (value: string | undefined) => formatDateCell(value),
  },
  {
    title: 'Хронология',
    dataIndex: 'chronology_items',
    key: 'chronology_items',
    width: 320,
    render: (items: ChronologyItem[]) => formatChronologyPreview(items),
  },
  {
    title: 'Дата выхода',
    dataIndex: 'construction_start_date',
    key: 'construction_start_date',
    width: 130,
    render: (value: string | undefined) => formatDateCell(value),
  },
  {
    title: 'Дата посещения',
    dataIndex: 'site_visit_date',
    key: 'site_visit_date',
    width: 140,
    render: (value: string | undefined) => formatDateCell(value),
  },
  {
    title: 'Фото площадки',
    dataIndex: 'site_visit_photo_url',
    key: 'site_visit_photo_url',
    width: 220,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Тендерный пакет',
    dataIndex: 'tender_package_items',
    key: 'tender_package_items',
    width: 260,
    render: (items: TenderPackageItem[]) => formatPackagePreview(items),
  },
  {
    title: 'Дата приглашения',
    dataIndex: 'invitation_date',
    key: 'invitation_date',
    width: 145,
    render: (value: string | undefined) => formatDateCell(value),
  },
  {
    title: 'Ввод в эксплуатацию',
    dataIndex: 'commission_date',
    key: 'commission_date',
    width: 170,
    render: (value: string | undefined) => formatDateCell(value),
  },
  {
    title: 'Предупреждения',
    dataIndex: 'warnings',
    key: 'warnings',
    width: 340,
    render: (warnings: string[]) => (warnings.length > 0 ? warnings.join('; ') : '-'),
  },
];

const normalizeWhitespace = (value?: string | null): string =>
  (value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHeader = (value: string): string =>
  normalizeWhitespace(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е');

const normalizeComparable = (value?: string | null): string =>
  normalizeWhitespace(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е');

const normalizeTenderTitle = (value?: string | null): string =>
  normalizeComparable(value).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

const pickString = (value: unknown): string | undefined => {
  if (value == null) {
    return undefined;
  }

  const stringValue = normalizeWhitespace(String(value));
  return stringValue || undefined;
};

function formatDateCell(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return '-';
  }

  return parsed.hour() === 0 && parsed.minute() === 0 ? parsed.format('DD.MM.YYYY') : parsed.format('DD.MM.YYYY HH:mm');
}

function formatChronologyPreview(items: ChronologyItem[]): string {
  if (!items.length) {
    return '-';
  }

  return items
    .map((item) => `${formatDateCell(item.date)} - ${item.text}`)
    .join(' | ');
}

function formatPackagePreview(items: TenderPackageItem[]): string {
  if (!items.length) {
    return '-';
  }

  return items.map((item) => item.text).join(', ');
}

function parseExcelDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(value);
    if (!parsedDate) {
      return null;
    }

    return dayjs(new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d, parsedDate.H || 0, parsedDate.M || 0, parsedDate.S || 0)).toISOString();
  }

  if (value instanceof Date) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.toISOString() : null;
  }

  if (typeof value === 'string') {
    const trimmed = normalizeWhitespace(value);
    if (!trimmed) {
      return null;
    }

    const strictParsed = dayjs(trimmed, DATE_FORMATS, true);
    if (strictParsed.isValid()) {
      return strictParsed.toISOString();
    }

    const looseParsed = dayjs(trimmed);
    return looseParsed.isValid() ? looseParsed.toISOString() : null;
  }

  return null;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const sanitized = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/[₽$€£¥]/g, '')
    .replace(/\b(руб\.?|rur|rub)\b/gi, '')
    .replace(/[^\d.,\-\s]/g, '')
    .trim();
  const parsed = parseMoneyInput(sanitized);
  return parsed == null ? undefined : parsed;
}

function splitPackageItems(value: string): TenderPackageItem[] {
  const parts = value
    .split(/[\n;,]+/g)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  return dedupePackageItems(parts.map((text) => ({ date: null, text })));
}

function parseChronologyItems(rawValue: unknown): ChronologyItem[] {
  const rawText = pickString(rawValue);
  if (!rawText) {
    return [];
  }

  const normalizedText = rawText.replace(/\r/g, '\n');
  const eventPattern =
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)\s*[-–—:]\s*([\s\S]*?)(?=(?:[,;\n]\s*)?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s+\d{1,2}:\d{2})?\s*[-–—:]|$)/g;

  const matchedItems: ChronologyItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = eventPattern.exec(normalizedText)) !== null) {
    const date = parseExcelDate(match[1]);
    const text = normalizeWhitespace(match[2].replace(/^[,;]+/, ''));

    if (text) {
      matchedItems.push({
        date,
        text,
        type: 'default',
      });
    }
  }

  if (matchedItems.length > 0) {
    return sortChronologyItems(dedupeChronologyItems(matchedItems));
  }

  return [
    {
      date: null,
      text: normalizedText,
      type: 'default',
    },
  ];
}

function getChronologyItemKey(item: ChronologyItem): string {
  return [
    item.date ? dayjs(item.date).toISOString() : '',
    normalizeComparable(item.text),
    item.type || 'default',
  ].join('|');
}

function dedupeChronologyItems(items: ChronologyItem[]): ChronologyItem[] {
  const uniqueItems = new Map<string, ChronologyItem>();

  items.forEach((item) => {
    const key = getChronologyItemKey(item);
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, {
        date: item.date ?? null,
        text: normalizeWhitespace(item.text),
        type: item.type ?? 'default',
      });
    }
  });

  return Array.from(uniqueItems.values());
}

function getPackageItemKey(item: TenderPackageItem): string {
  return [
    item.date ? dayjs(item.date).toISOString() : '',
    normalizeComparable(item.text),
    normalizeComparable(item.link),
  ].join('|');
}

function dedupePackageItems(items: TenderPackageItem[]): TenderPackageItem[] {
  const uniqueItems = new Map<string, TenderPackageItem>();

  items.forEach((item) => {
    const normalizedItem: TenderPackageItem = {
      date: item.date ?? null,
      text: normalizeWhitespace(item.text),
      link: pickString(item.link) || null,
    };
    const key = getPackageItemKey(normalizedItem);
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, normalizedItem);
    }
  });

  return Array.from(uniqueItems.values());
}

function formatImportHeaderForDisplay(header: string): string {
  const emptyMatch = header.match(/^__EMPTY(?:_(\d+))?$/i);
  if (emptyMatch) {
    const rawIndex = emptyMatch[1] ? Number(emptyMatch[1]) + 1 : 1;
    return `Пустая колонка ${rawIndex}`;
  }

  return header;
}

function mergeOptionalString(importedValue: string | null | undefined, existingValue: string | null | undefined): string | null {
  const normalizedImported = pickString(importedValue);
  if (normalizedImported !== undefined) {
    return normalizedImported;
  }

  return existingValue || null;
}

function mergeOptionalNumber(importedValue: number | null | undefined, existingValue: number | null | undefined): number | null {
  if (importedValue != null) {
    return importedValue;
  }

  return existingValue ?? null;
}

function getAliasedValue(rowMap: Map<string, unknown>, field: SupportedImportField): unknown {
  const aliases = FIELD_ALIASES[field];

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (rowMap.has(normalizedAlias)) {
      return rowMap.get(normalizedAlias);
    }
  }

  return undefined;
}

function getDashboardStatusFromImportedStatus(statusName?: string | null): DashboardStatus | null {
  const normalized = normalizeComparable(statusName);
  if (!normalized) {
    return null;
  }

  if (normalized === 'направлено') {
    return 'sent';
  }

  return getDashboardStatusByStatusName(statusName);
}

function buildExistingTenderMaps(existingTenders: ExistingTenderLite[]) {
  const byNumber = new Map<string, ExistingTenderLite>();
  const byTitleClient = new Map<string, ExistingTenderLite>();
  const titleBuckets = new Map<string, ExistingTenderLite[]>();

  existingTenders.forEach((tender) => {
    const normalizedNumber = normalizeComparable(tender.tender_number);
    const normalizedTitle = normalizeTenderTitle(tender.title);
    const normalizedClient = normalizeComparable(tender.client_name);

    if (normalizedNumber && !byNumber.has(normalizedNumber)) {
      byNumber.set(normalizedNumber, tender);
    }

    if (normalizedTitle && normalizedClient) {
      const key = `${normalizedTitle}|${normalizedClient}`;
      if (!byTitleClient.has(key)) {
        byTitleClient.set(key, tender);
      }
    }

    if (normalizedTitle) {
      const bucket = titleBuckets.get(normalizedTitle) || [];
      bucket.push(tender);
      titleBuckets.set(normalizedTitle, bucket);
    }
  });

  const uniqueByTitle = new Map<string, ExistingTenderLite>();
  titleBuckets.forEach((items, key) => {
    if (items.length === 1) {
      uniqueByTitle.set(key, items[0]);
    }
  });

  return { byNumber, byTitleClient, uniqueByTitle, titleBuckets };
}

function matchExistingTender(
  row: ImportedTenderRow,
  maps: ReturnType<typeof buildExistingTenderMaps>
): { tender?: ExistingTenderLite; matchedBy?: string; warning?: string } {
  const normalizedNumber = normalizeComparable(row.tender_number);
  const normalizedTitle = normalizeTenderTitle(row.title);
  const normalizedClient = normalizeComparable(row.client_name);

  if (normalizedNumber) {
    const byNumber = maps.byNumber.get(normalizedNumber);
    if (byNumber) {
      return { tender: byNumber, matchedBy: 'По номеру тендера' };
    }
  }

  if (normalizedTitle && normalizedClient) {
    const byTitleClient = maps.byTitleClient.get(`${normalizedTitle}|${normalizedClient}`);
    if (byTitleClient) {
      return { tender: byTitleClient, matchedBy: 'По наименованию и заказчику' };
    }
  }

  if (normalizedTitle) {
    const uniqueByTitle = maps.uniqueByTitle.get(normalizedTitle);
    if (uniqueByTitle) {
      return { tender: uniqueByTitle, matchedBy: 'По наименованию' };
    }

    const titleDuplicates = maps.titleBuckets.get(normalizedTitle);
    if (titleDuplicates && titleDuplicates.length > 1) {
      return { warning: 'Найдено несколько существующих тендеров с таким наименованием, строка не обновлена автоматически' };
    }
  }

  return {};
}

function buildImportedRow(rawRow: Record<string, unknown>): ImportedTenderRow {
  const rowMap = new Map<string, unknown>();
  Object.entries(rawRow).forEach(([key, value]) => {
    rowMap.set(normalizeHeader(key), value);
  });

  const tenderPackageValue = getAliasedValue(rowMap, 'tender_package');

  return {
    tender_number: pickString(getAliasedValue(rowMap, 'tender_number')),
    title: pickString(getAliasedValue(rowMap, 'title')),
    client_name: pickString(getAliasedValue(rowMap, 'client_name')),
    object_address: pickString(getAliasedValue(rowMap, 'object_address')),
    object_coordinates: pickString(getAliasedValue(rowMap, 'object_coordinates')),
    construction_scope: pickString(getAliasedValue(rowMap, 'construction_scope')),
    area: parseNumber(getAliasedValue(rowMap, 'area')),
    manual_total_cost: parseNumber(getAliasedValue(rowMap, 'manual_total_cost')),
    submission_date: parseExcelDate(getAliasedValue(rowMap, 'submission_date')) || undefined,
    chronology_items: parseChronologyItems(getAliasedValue(rowMap, 'chronology')),
    construction_start_date: parseExcelDate(getAliasedValue(rowMap, 'construction_start_date')) || undefined,
    site_visit_date: parseExcelDate(getAliasedValue(rowMap, 'site_visit_date')) || undefined,
    site_visit_photo_url: pickString(getAliasedValue(rowMap, 'site_visit_photo_url')),
    tender_package_items:
      typeof tenderPackageValue === 'string'
        ? splitPackageItems(tenderPackageValue)
        : tenderPackageValue != null
          ? splitPackageItems(String(tenderPackageValue))
          : [],
    invitation_date: parseExcelDate(getAliasedValue(rowMap, 'invitation_date')) || undefined,
    status: pickString(getAliasedValue(rowMap, 'status')),
    commission_date: parseExcelDate(getAliasedValue(rowMap, 'commission_date')) || undefined,
  };
}

function buildMergedPayload(params: {
  row: ImportedTenderRow;
  existingTender?: ExistingTenderLite;
  constructionScopes: ConstructionScope[];
  statuses: TenderStatus[];
  nextSortOrder: number;
}): { payload?: TenderRegistryInsert; warnings: string[] } {
  const { row, existingTender, constructionScopes, statuses, nextSortOrder } = params;
  const warnings: string[] = [];

  const constructionScopeId = (() => {
    if (!row.construction_scope) {
      return existingTender?.construction_scope_id || null;
    }

    const matchedScope = constructionScopes.find(
      (scope) => normalizeComparable(scope.name) === normalizeComparable(row.construction_scope)
    );

    if (!matchedScope) {
      warnings.push(`Не найден объем строительства "${row.construction_scope}"`);
      return existingTender?.construction_scope_id || null;
    }

    return matchedScope.id;
  })();

  const derivedDashboardStatus = getDashboardStatusFromImportedStatus(row.status);
  const statusId = (() => {
    if (!row.status) {
      return existingTender?.status_id || null;
    }

    const normalizedStatus = normalizeComparable(row.status);
    if (normalizedStatus === 'направлено') {
      return null;
    }

    const matchedStatus = statuses.find(
      (status) => normalizeComparable(status.name) === normalizedStatus
    );

    if (!matchedStatus) {
      warnings.push(`Не найден статус "${row.status}"`);
      return existingTender?.status_id || null;
    }

    return matchedStatus.id;
  })();

  const mergedChronology = sortChronologyItems(
    dedupeChronologyItems([...(existingTender?.chronology_items || []), ...row.chronology_items])
  );
  const mergedPackage = dedupePackageItems([...(existingTender?.tender_package_items || []), ...row.tender_package_items]);

  const payload: TenderRegistryInsert = {
    tender_number: mergeOptionalString(row.tender_number, existingTender?.tender_number),
    title: mergeOptionalString(row.title, existingTender?.title) || '',
    client_name: mergeOptionalString(row.client_name, existingTender?.client_name) || '',
    object_address: mergeOptionalString(row.object_address, existingTender?.object_address),
    object_coordinates: mergeOptionalString(row.object_coordinates, existingTender?.object_coordinates),
    construction_scope_id: constructionScopeId,
    area: mergeOptionalNumber(row.area, existingTender?.area),
    manual_total_cost: mergeOptionalNumber(row.manual_total_cost, existingTender?.manual_total_cost),
    submission_date: mergeOptionalString(row.submission_date, existingTender?.submission_date),
    chronology_items: mergedChronology,
    construction_start_date: mergeOptionalString(row.construction_start_date, existingTender?.construction_start_date),
    site_visit_date: mergeOptionalString(row.site_visit_date, existingTender?.site_visit_date),
    site_visit_photo_url: mergeOptionalString(row.site_visit_photo_url, existingTender?.site_visit_photo_url),
    tender_package_items: mergedPackage,
    invitation_date: mergeOptionalString(row.invitation_date, existingTender?.invitation_date),
    status_id: statusId,
    commission_date: mergeOptionalString(row.commission_date, existingTender?.commission_date),
    dashboard_status: derivedDashboardStatus || existingTender?.dashboard_status || 'calc',
    is_archived: (derivedDashboardStatus || existingTender?.dashboard_status) === 'archive' || existingTender?.is_archived || false,
    sort_order: existingTender?.sort_order ?? nextSortOrder,
  };

  if (!payload.title) {
    warnings.push('Не заполнено наименование тендера');
  }

  if (!payload.client_name) {
    warnings.push('Не заполнен заказчик');
  }

  if (!existingTender && (!payload.title || !payload.client_name)) {
    return { warnings, payload: undefined };
  }

  return { warnings, payload };
}

function buildStagedTender(payload: TenderRegistryInsert, existingTender: ExistingTenderLite): ExistingTenderLite {
  const now = new Date().toISOString();

  return {
    ...existingTender,
    updated_at: now,
    tender_number: payload.tender_number || null,
    title: payload.title,
    client_name: payload.client_name,
    object_address: payload.object_address || null,
    object_coordinates: payload.object_coordinates || null,
    construction_scope_id: payload.construction_scope_id || null,
    area: payload.area ?? null,
    manual_total_cost: payload.manual_total_cost ?? null,
    submission_date: payload.submission_date || null,
    chronology_items: payload.chronology_items || [],
    construction_start_date: payload.construction_start_date || null,
    site_visit_date: payload.site_visit_date || null,
    site_visit_photo_url: payload.site_visit_photo_url || null,
    tender_package_items: payload.tender_package_items || [],
    invitation_date: payload.invitation_date || null,
    status_id: payload.status_id || null,
    commission_date: payload.commission_date || null,
    dashboard_status: payload.dashboard_status || 'calc',
    is_archived: payload.is_archived || false,
    sort_order: payload.sort_order || existingTender.sort_order,
  };
}

function getRecognizedHeaders(headers: string[]) {
  const normalizedAliases = new Map<string, SupportedImportField>();
  SUPPORTED_FIELDS.forEach((field) => {
    FIELD_ALIASES[field].forEach((alias) => {
      normalizedAliases.set(normalizeHeader(alias), field);
    });
  });

  const recognized = new Set<string>();
  const unknown: string[] = [];

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (normalizedAliases.has(normalized)) {
      recognized.add(header);
      return;
    }
    unknown.push(formatImportHeaderForDisplay(header));
  });

  return {
    recognized: Array.from(recognized),
    unknown,
  };
}

const ImportTendersModal: React.FC<ImportTendersModalProps> = ({
  open,
  onCancel,
  onSuccess,
  constructionScopes,
  statuses,
}) => {
  const [parsedData, setParsedData] = useState<ImportPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [recognizedHeaders, setRecognizedHeaders] = useState<string[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);

  const actionableRows = useMemo(
    () => parsedData.filter((row) => row.action !== 'skip' && row.payload),
    [parsedData]
  );

  const summary = useMemo(
    () =>
      parsedData.reduce(
        (acc, row) => {
          if (row.action === 'create') acc.create += 1;
          if (row.action === 'update') acc.update += 1;
          if (row.action === 'skip') acc.skip += 1;
          if (row.warnings.length > 0) acc.warnings += row.warnings.length;
          return acc;
        },
        { create: 0, update: 0, skip: 0, warnings: 0 }
      ),
    [parsedData]
  );

  const resetState = () => {
    setParsedData([]);
    setFileList([]);
    setRecognizedHeaders([]);
    setUnknownHeaders([]);
  };

  const handleFileUpload = (file: File) => {
    setFileList([
      {
        uid: `${Date.now()}`,
        name: file.name,
        status: 'uploading',
      },
    ]);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: null,
          raw: true,
        });

        if (jsonData.length === 0) {
          resetState();
          message.warning('Файл не содержит строк для импорта');
          return;
        }

        const headers = Object.keys(jsonData[0] || {});
        const headerInfo = getRecognizedHeaders(headers);

        const { data: existingRows, error } = await supabase
          .from('tender_registry')
          .select(
            'id, created_at, updated_at, tender_number, title, client_name, object_address, object_coordinates, construction_scope_id, area, manual_total_cost, submission_date, chronology_items, construction_start_date, site_visit_date, site_visit_photo_url, tender_package_items, invitation_date, status_id, commission_date, dashboard_status, is_archived, sort_order'
          )
          .order('updated_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        const existingTenders = (existingRows || []) as ExistingTenderLite[];
        let stagedExistingTenders = [...existingTenders];
        let nextSortOrder =
          existingTenders.reduce((maxValue, tender) => Math.max(maxValue, tender.sort_order || 0), 0) + 1;

        const previewRows: ImportPreviewRow[] = [];

        jsonData.forEach((rawRow, index) => {
          const row = buildImportedRow(rawRow);
          const warnings: string[] = [];
          const maps = buildExistingTenderMaps(stagedExistingTenders);
          const match = matchExistingTender(row, maps);

          if (match.warning) {
            warnings.push(match.warning);
          }

          const { payload, warnings: payloadWarnings } = buildMergedPayload({
            row,
            existingTender: match.tender,
            constructionScopes,
            statuses,
            nextSortOrder,
          });

          warnings.push(...payloadWarnings);

          const action: ImportPreviewRow['action'] = payload
            ? match.tender
              ? 'update'
              : 'create'
            : 'skip';

          if (action === 'create') {
            nextSortOrder += 1;
          }

          if (action === 'update' && payload && match.tender) {
            stagedExistingTenders = stagedExistingTenders.map((tender) =>
              tender.id === match.tender?.id ? buildStagedTender(payload, tender) : tender
            );
          }

          previewRows.push({
            ...row,
            rowNumber: index + 2,
            action,
            matchedTenderId: match.tender?.id,
            matchedBy: match.matchedBy,
            warnings,
            payload,
          });
        });

        setParsedData(previewRows);
        setRecognizedHeaders(headerInfo.recognized);
        setUnknownHeaders(headerInfo.unknown);
        setFileList([
          {
            uid: `${Date.now()}`,
            name: file.name,
            status: 'done',
          },
        ]);

        message.success(
          `Файл обработан: ${previewRows.length} строк, создание ${previewRows.filter((row) => row.action === 'create').length}, обновление ${previewRows.filter((row) => row.action === 'update').length}`
        );
      } catch (error) {
        resetState();
        message.error(`Ошибка чтения файла: ${(error as Error).message}`);
      }
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleImport = async () => {
    if (actionableRows.length === 0) {
      message.warning('Нет строк, готовых к импорту');
      return;
    }

    setLoading(true);

    try {
      const rowsToCreate = actionableRows.filter((row) => row.action === 'create' && row.payload);
      const rowsToUpdate = actionableRows.filter((row) => row.action === 'update' && row.payload && row.matchedTenderId);

      if (rowsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('tender_registry')
          .insert(rowsToCreate.map((row) => row.payload as TenderRegistryInsert));

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      for (const row of rowsToUpdate) {
        const { error: updateError } = await supabase
          .from('tender_registry')
          .update(row.payload as TenderRegistryInsert)
          .eq('id', row.matchedTenderId as string);

        if (updateError) {
          throw new Error(`Строка ${row.rowNumber}: ${updateError.message}`);
        }
      }

      message.success(
        `Импорт завершён: создано ${rowsToCreate.length}, обновлено ${rowsToUpdate.length}, пропущено ${summary.skip}`
      );
      resetState();
      onSuccess();
    } catch (error) {
      message.error(`Ошибка при импорте: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  return (
    <Modal
      title="Импорт тендеров из Excel"
      open={open}
      onCancel={handleCancel}
      onOk={handleImport}
      okText="Импортировать"
      cancelText="Отмена"
      width={1480}
      confirmLoading={loading}
      okButtonProps={{ disabled: actionableRows.length === 0 }}
    >
      <Alert
        message="Импорт поддерживает частично заполненные файлы"
        description="Будут обработаны только распознанные колонки. Если тендер уже существует, импорт обновит запись и добавит новые элементы хронологии и тендерного пакета к уже сохранённым."
        type="info"
        style={{ marginBottom: 16 }}
      />

      <Upload.Dragger
        fileList={fileList}
        beforeUpload={handleFileUpload}
        onRemove={() => {
          resetState();
          return true;
        }}
        accept=".xlsx,.xls"
        maxCount={1}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Нажмите или перетащите Excel-файл для загрузки</p>
        <p className="ant-upload-hint">Поддерживаются файлы форматов .xlsx и .xls</p>
      </Upload.Dragger>

      {parsedData.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Alert
            type={summary.skip > 0 || summary.warnings > 0 ? 'warning' : 'success'}
            showIcon
            style={{ marginBottom: 12 }}
            message={`Предпросмотр: ${parsedData.length} строк`}
            description={
              <div>
                <div>Создание: {summary.create}. Обновление: {summary.update}. Пропуск: {summary.skip}. Предупреждения: {summary.warnings}.</div>
                {recognizedHeaders.length > 0 ? <div>Распознано колонок: {recognizedHeaders.join(', ')}.</div> : null}
                {unknownHeaders.length > 0 ? <div>Колонки файла без маппинга: {unknownHeaders.join(', ')}.</div> : null}
              </div>
            }
          />

          {summary.skip > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Часть строк будет пропущена"
              description={parsedData
                .filter((row) => row.action === 'skip')
                .slice(0, 5)
                .map((row) => `Строка ${row.rowNumber}: ${row.warnings.join('; ') || 'не удалось собрать данные для сохранения'}`)
                .join(' | ')}
            />
          )}

          <Table
            dataSource={parsedData}
            columns={PREVIEW_COLUMNS}
            rowKey={(record) => `${record.rowNumber}-${record.title || 'empty'}`}
            pagination={{ pageSize: 5, showSizeChanger: true }}
            scroll={{ x: 3200 }}
            size="small"
          />

          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              Хронология в одной ячейке теперь разбирается на отдельные события по шаблону `дата - описание`.
            </Text>
            <br />
            <Text type="secondary">
              Пустые ячейки в импортируемом файле не очищают уже сохранённые значения тендера.
            </Text>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportTendersModal;
