import {
  approvalRecords,
  demandLines,
  roleInboxItems,
  stockMovements,
  workflowDocuments,
  workflowLanes,
} from './workflowData';
import type { ApprovalType, StockMovementType, WorkflowLaneId } from './types';

export function getLaneById(id: WorkflowLaneId) {
  return workflowLanes.find((lane) => lane.id === id);
}

export function getLaneByRoute(pathname: string) {
  return workflowLanes.find((lane) => lane.route === pathname);
}

export function getBlockedWorkflowItems() {
  return roleInboxItems.filter((item) => item.tone === 'danger');
}

export function getRoleInboxByLane(laneId: WorkflowLaneId) {
  return roleInboxItems.filter((item) => item.laneId === laneId);
}

export function getApprovalRecordsByType(type?: ApprovalType) {
  return type ? approvalRecords.filter((record) => record.type === type) : approvalRecords;
}

export function getDemandShortages() {
  return demandLines.filter((line) => line.required > line.available - line.reserved);
}

export function getDocumentsByOwner(owner: string) {
  return workflowDocuments.filter((document) => document.owner === owner);
}

export function getDocumentByType(type: string) {
  return workflowDocuments.filter((document) => document.type === type);
}

export function getStockMovementsByType(type?: StockMovementType) {
  return type ? stockMovements.filter((movement) => movement.type === type) : stockMovements;
}

export function getWorkflowContextForPath(pathname: string) {
  const lane = getLaneByRoute(pathname) ?? workflowLanes[0];

  return {
    lane,
    inbox: getRoleInboxByLane(lane.id),
    documents: workflowDocuments.filter((document) => document.route === lane.route),
    blockedItems: getBlockedWorkflowItems(),
  };
}

export function getWorkflowTotals() {
  return workflowLanes.reduce(
    (totals, lane) => ({
      waiting: totals.waiting + lane.waiting,
      blocked: totals.blocked + lane.blocked,
      done: totals.done + lane.done,
    }),
    { waiting: 0, blocked: 0, done: 0 },
  );
}
