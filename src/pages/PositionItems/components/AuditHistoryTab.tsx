import React, { useState } from 'react';
import { Card, Space } from 'antd';
import AuditFilters from './AuditFilters';
import AuditHistoryTable from './AuditHistoryTable';
import type { AuditFilters as Filters } from '../../../types/audit';

interface AuditHistoryTabProps {
  positionId: string | undefined;
}

/**
 * Вкладка истории изменений BOQ items
 */
const AuditHistoryTab: React.FC<AuditHistoryTabProps> = ({ positionId }) => {
  const [filters, setFilters] = useState<Filters>({});

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <AuditFilters filters={filters} onChange={setFilters} />
        <AuditHistoryTable positionId={positionId} filters={filters} />
      </Space>
    </Card>
  );
};

export default AuditHistoryTab;
