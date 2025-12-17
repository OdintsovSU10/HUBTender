import React, { useState, useEffect } from 'react';
import { Row, Col, DatePicker, Select, Button } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { supabase } from '../../../lib/supabase';
import type { AuditFilters, AuditOperationType } from '../../../types/audit';

const { RangePicker } = DatePicker;

interface AuditFiltersProps {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

/**
 * Компонент фильтров для истории изменений
 */
const AuditFiltersComponent: React.FC<AuditFiltersProps> = ({ filters, onChange }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Загрузка списка пользователей
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('access_enabled', true)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[AuditFilters] Ошибка загрузки пользователей:', error);
        return;
      }

      setUsers(data || []);
    };

    fetchUsers();
  }, []);

  // Синхронизация dateRange с filters
  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) {
      setDateRange([dayjs(filters.dateFrom), dayjs(filters.dateTo)]);
    } else {
      setDateRange(null);
    }
  }, [filters.dateFrom, filters.dateTo]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates);

    if (dates && dates[0] && dates[1]) {
      onChange({
        ...filters,
        dateFrom: dates[0].startOf('day').toISOString(),
        dateTo: dates[1].endOf('day').toISOString(),
      });
    } else {
      onChange({
        ...filters,
        dateFrom: undefined,
        dateTo: undefined,
      });
    }
  };

  const handleUserChange = (userId: string | undefined) => {
    onChange({
      ...filters,
      userId,
    });
  };

  const handleOperationChange = (operationType: AuditOperationType | undefined) => {
    onChange({
      ...filters,
      operationType,
    });
  };

  const handleClearFilters = () => {
    setDateRange(null);
    onChange({
      dateFrom: undefined,
      dateTo: undefined,
      userId: undefined,
      operationType: undefined,
    });
  };

  const hasActiveFilters =
    filters.dateFrom || filters.dateTo || filters.userId || filters.operationType;

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col xs={24} sm={24} md={10}>
        <RangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
          style={{ width: '100%' }}
          placeholder={['Дата от', 'Дата до']}
          format="DD.MM.YYYY"
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Select
          value={filters.userId}
          onChange={handleUserChange}
          style={{ width: '100%' }}
          placeholder="Все пользователи"
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
          }
          options={users.map((user) => ({
            value: user.id,
            label: user.full_name || user.email,
          }))}
        />
      </Col>

      <Col xs={24} sm={12} md={5}>
        <Select
          value={filters.operationType}
          onChange={handleOperationChange}
          style={{ width: '100%' }}
          placeholder="Все операции"
          allowClear
          options={[
            { value: 'INSERT', label: 'Добавление' },
            { value: 'UPDATE', label: 'Изменение' },
            { value: 'DELETE', label: 'Удаление' },
          ]}
        />
      </Col>

      <Col xs={24} sm={24} md={3}>
        <Button
          icon={hasActiveFilters ? <ClearOutlined /> : <FilterOutlined />}
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
          block
        >
          {hasActiveFilters ? 'Сбросить' : 'Фильтры'}
        </Button>
      </Col>
    </Row>
  );
};

export default AuditFiltersComponent;
