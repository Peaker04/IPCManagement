import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { DataTableShell } from './DataTableShell';
import type { WorkflowLane } from '@/features/workflow';

interface SwimlaneProgressProps {
  lanes: WorkflowLane[];
  activeLaneId?: WorkflowLane['id'];
  actionForLane?: (lane: WorkflowLane) => ReactNode;
  className?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function SwimlaneProgress({ lanes, activeLaneId, actionForLane, className }: SwimlaneProgressProps) {
  return (
    <DataTableShell className={cn('ipc-logistics-table-shell', className)} ariaLabel="Bảng trạng thái các lane vận hành">
      <table className="ipc-data-table ipc-logistics-table ipc-swimlane-table">
        <thead>
          <tr>
            <th className="!text-left">Lane</th>
            <th className="!text-center">Trạng thái</th>
            <th className="!text-left">Phụ trách</th>
            <th className="!text-center">Chờ</th>
            <th className="!text-center">Tắc</th>
            <th className="!text-left">Hành động kế tiếp</th>
            {actionForLane ? <th className="!text-right">Điều Hướng</th> : null}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane, index) => (
            <tr
              key={lane.id}
              className={cn(
                'ipc-logistics-row',
                toneClasses[lane.tone],
                activeLaneId === lane.id && 'is-active',
              )}
            >
              <td className="!text-left">
                <div className="ipc-lane-cell">
                  <span className="ipc-lane-index">{index + 1}</span>
                  <strong>{lane.label}</strong>
                </div>
              </td>
              <td className="ipc-badge-cell text-center">
                <StatusBadge variant={lane.tone} className="ipc-table-badge ipc-table-badge--status">
                  {lane.status}
                </StatusBadge>
              </td>
              <td className="!text-left">
                <span className="ipc-muted-cell">{lane.owner}</span>
              </td>
              <td className="ipc-number-cell">{lane.waiting}</td>
              <td className={cn('ipc-number-cell', lane.blocked > 0 && 'is-danger')}>{lane.blocked}</td>
              <td className="!text-left">
                <span className="ipc-next-action-cell">{lane.nextAction}</span>
              </td>
              {actionForLane ? <td className="ipc-row-action-cell">{actionForLane(lane)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
