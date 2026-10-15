import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { SplitView } from '../../components/workbench/SplitView';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { dashboardApi, type DashboardData } from '../../api/dashboardApi';
import type { DashboardTask } from '../../types';
import { clsx } from 'clsx';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await dashboardApi.getDashboardData();
      setData(resp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu điều hành hôm nay.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchInitialData() {
      try {
        const resp = await dashboardApi.getDashboardData();
        if (!ignore) {
          setData(resp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu điều hành hôm nay.');
          setIsLoading(false);
        }
      }
    }

    fetchInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    if (!selectedMetricId) return data.tasks;
    if (selectedMetricId === 'm2') return data.tasks.filter((t) => t.roleCode === 'CHEF');
    if (selectedMetricId === 'm3') return data.tasks.filter((t) => t.roleCode === 'PURCHASER');
    if (selectedMetricId === 'm4') return data.tasks.filter((t) => t.roleCode === 'WAREHOUSE');
    return data.tasks;
  }, [data, selectedMetricId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: Workspace Header (56px / h-14) */}
      <WorkspaceHeader
        title="Bàn điều hành hôm nay"
        contextSelectors={
          <>
            <span className="text-sm text-slate-700 font-medium">
              Thứ Hai, 21/09/2026
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="info" size="default" className="text-xs px-2.5 py-1">
              Ca 1 & Ca 2 đang vận hành
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="default" onClick={handleRefresh} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              onClick={() => navigate('/weekly-menu?view=demand')}
              className="h-9 text-sm font-medium"
            >
              Mở bàn giao ca
            </Button>
          </>
        }
      />

      {/* Dải 5 ô chỉ số phẳng (56px / h-14) */}
      <div className="h-14 shrink-0 border-b border-slate-200 bg-white grid grid-cols-5 divide-x divide-slate-200 text-sm select-none">
        {data?.metrics.map((metric) => {
          const isSelected = selectedMetricId === metric.id;
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() =>
                setSelectedMetricId(selectedMetricId === metric.id ? null : metric.id)
              }
              className={clsx(
                'flex flex-col justify-center px-4 transition-colors text-left cursor-pointer group',
                isSelected ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-500' : 'hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium truncate">
                  {metric.label}
                </span>
                {metric.unit && (
                  <span className="text-xs text-slate-400 font-mono">
                    {metric.unit}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold text-slate-900 font-mono tracking-tight tabular-nums">
                  {metric.value}
                </span>
                {metric.trend && (
                  <span
                    className={clsx(
                      'text-xs truncate',
                      metric.variant === 'danger'
                        ? 'text-rose-600 font-medium'
                        : metric.variant === 'warning'
                        ? 'text-amber-600 font-medium'
                        : metric.variant === 'success'
                        ? 'text-emerald-600'
                        : 'text-slate-500'
                    )}
                  >
                    {metric.trend}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Zone 3: SplitView (Left: Tasks Table 8 cols | Right: 4-Stage Stepper 4 cols) */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={handleRefresh}
        isEmpty={!data || data.tasks.length === 0}
        emptyTitle="Hôm nay không có nhiệm vụ tồn đọng"
        emptyDescription="Mọi công đoạn ca hôm nay đã hoàn thành hoặc chưa đến giờ kích hoạt."
      >
        {data && (
          <SplitView
            masterWidthClass="w-8/12"
            master={
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                {/* Table Header Strip */}
                <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Việc cần xử lý trước
                    </span>
                    <Badge variant="neutral" size="sm">
                      {filteredTasks.length} nhiệm vụ
                    </Badge>
                  </div>
                  {selectedMetricId && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSelectedMetricId(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Bỏ lọc metric
                    </Button>
                  )}
                </div>

                {/* Table Content */}
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-left text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="h-10 px-4 w-[42%]">Nhiệm vụ & Quy trình</th>
                        <th className="h-10 px-3 w-[26%]">Phụ trách</th>
                        <th className="h-10 px-3 w-[18%]">Thời hạn</th>
                        <th className="h-10 px-4 w-[14%] text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredTasks.map((task: DashboardTask, idx: number) => (
                        <tr
                          key={task.id}
                          className={clsx(
                            'h-10 hover:bg-slate-50 transition-colors',
                            idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                          )}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={clsx(
                                  'h-2 w-2 rounded-full shrink-0',
                                  task.priority === 'high'
                                    ? 'bg-rose-500'
                                    : task.priority === 'medium'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300'
                                )}
                              />
                              <span className="font-medium text-slate-900 truncate text-sm">
                                {task.title}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 truncate text-sm">
                            <span className="text-xs text-slate-400 mr-1">Phụ trách:</span>
                            <span>{task.assignee}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 truncate">
                            <span className="text-xs text-slate-400 mr-1">Hạn:</span>
                            <span>{task.deadline}</span>
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(task.actionRoute)}
                              className="font-medium text-xs h-7"
                            >
                              Xử lý
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            }
            detail={
              <div className="flex-1 min-h-0 flex flex-col bg-slate-50/40">
                {/* Stepper Header */}
                <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Tiến độ 4 công đoạn
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Ca 1 + Ca 2
                  </span>
                </div>

                {/* Vertical Stepper List */}
                <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3.5">
                  {data.stages.map((stage) => {
                    const isCompleted = stage.status === 'completed';
                    const isInProgress = stage.status === 'in_progress';
                    return (
                      <div
                        key={stage.stageNumber}
                        className={clsx(
                          'rounded-md border p-3.5 transition-colors',
                          isInProgress
                            ? 'bg-white border-blue-200 shadow-2xs'
                            : isCompleted
                            ? 'bg-white/80 border-slate-200'
                            : 'bg-slate-50 border-slate-200/60 opacity-70'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'h-5 w-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isInProgress
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              )}
                            >
                              {isCompleted ? '✓' : stage.stageNumber}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {stage.stageName}
                            </span>
                          </div>
                          <Badge
                            variant={
                              isCompleted
                                ? 'success'
                                : isInProgress
                                ? 'info'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {isCompleted
                              ? 'Đã xong'
                              : isInProgress
                              ? 'Đang chạy'
                              : 'Chờ'}
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-500 pl-7 leading-relaxed mb-2.5">
                          {stage.description}
                        </p>

                        <div className="flex items-center justify-between pl-7 pt-1 border-t border-slate-100 text-xs">
                          <span className="font-mono text-slate-600">
                            Hoàn thành: {stage.completedCount}/{stage.totalCount}
                          </span>
                          {stage.actionLabel && stage.actionRoute && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => navigate(stage.actionRoute!)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {stage.actionLabel} →
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          />
        )}
      </StateBoundary>
    </div>
  );
}
