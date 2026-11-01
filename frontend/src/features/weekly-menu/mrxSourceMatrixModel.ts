import type { MrxEditScope } from '../../api/mrxApi';
import type { MrxSourceDraft } from './hooks/useMrxSourceEdit';

export type MrxMatrixMode = 'completion' | 'dish-edit';

export interface MrxMatrixSlotCell {
  serviceDate: string;
  shiftName: string;
  menuVariant: string;
  dishSlot: string;
  slotLabel: string;
  dishId: string;
  dishCode?: string | null;
  dishName?: string | null;
  isLocked: boolean;
  lockReason?: string | null;
}

export interface MrxMatrixDishCell {
  serviceDates: string[];
  shiftName: string;
  menuVariant: string;
  slots: MrxMatrixSlotCell[];
  dishId: string;
  dishCode?: string | null;
  dishName?: string | null;
  rowSpan: number;
  colSpan: number;
  isLocked: boolean;
  lockReason?: string | null;
}

export type MrxMatrixPosition =
  | { kind: 'cell'; cell: MrxMatrixDishCell }
  | { kind: 'covered' }
  | { kind: 'empty'; serviceDate: string; isLocked: boolean; lockReason?: string | null };

export interface MrxMatrixRow {
  dishSlot: string;
  slotLabel: string;
  positions: MrxMatrixPosition[];
}

export interface MrxMatrixServingCell {
  serviceDate: string;
  value: number | null;
  isLocked: boolean;
  lockReason?: string | null;
}

export interface MrxMatrixSection {
  key: string;
  label: string;
  shiftName: string;
  menuVariant: string;
  servings: MrxMatrixServingCell[];
  rows: MrxMatrixRow[];
}

export interface MrxSourceMatrix {
  dates: string[];
  sections: MrxMatrixSection[];
}

function shiftLabel(shiftName: string): string {
  if (shiftName === 'MORNING') return 'CA SÁNG';
  if (shiftName === 'AFTERNOON') return 'CA CHIỀU';
  return shiftName;
}

function variantLabel(variant: string): string {
  return variant === 'vegetarian' ? 'CHAY' : 'MẶN';
}

function sameHorizontalBlock(left: MrxMatrixDishCell, right: MrxMatrixDishCell): boolean {
  return left.dishId !== ''
    && left.dishId === right.dishId
    && left.shiftName === right.shiftName
    && left.menuVariant === right.menuVariant
    && left.rowSpan === right.rowSpan
    && left.isLocked === right.isLocked
    && left.slots.map((slot) => slot.dishSlot).join('|') === right.slots.map((slot) => slot.dishSlot).join('|');
}

export function buildMrxSourceMatrix(
  scope: MrxEditScope,
  draft: MrxSourceDraft,
  mode: MrxMatrixMode,
): MrxSourceMatrix {
  const dates = scope.days.map((day) => day.serviceDate);
  const sectionKeys: Array<{ shiftName: string; menuVariant: string }> = [];

  for (const day of scope.days) {
    for (const shift of day.shifts) {
      const variants = ['savory', 'vegetarian', ...shift.slots.map((slot) => slot.menuVariant)];
      for (const menuVariant of variants) {
        if (!sectionKeys.some((section) => section.shiftName === shift.shiftName && section.menuVariant === menuVariant)) {
          sectionKeys.push({ shiftName: shift.shiftName, menuVariant });
        }
      }
    }
  }

  sectionKeys.sort((left, right) => {
    const shiftOrder = (value: string) => value === 'MORNING' ? 0 : value === 'AFTERNOON' ? 1 : 2;
    const shiftDifference = shiftOrder(left.shiftName) - shiftOrder(right.shiftName);
    if (shiftDifference !== 0) return shiftDifference;
    return left.menuVariant === right.menuVariant ? 0 : left.menuVariant === 'savory' ? -1 : 1;
  });

  const sections = sectionKeys.map(({ shiftName, menuVariant }): MrxMatrixSection => {
    const orderedSlots: Array<{ dishSlot: string; slotLabel: string }> = [];
    for (const day of scope.days) {
      const shift = day.shifts.find((item) => item.shiftName === shiftName);
      for (const slot of shift?.slots.filter((item) => item.menuVariant === menuVariant) ?? []) {
        if (!orderedSlots.some((item) => item.dishSlot === slot.dishSlot)) {
          orderedSlots.push({ dishSlot: slot.dishSlot, slotLabel: slot.slotLabel });
        }
      }
    }

    const positionsByRow: MrxMatrixPosition[][] = orderedSlots.map(() => []);

    scope.days.forEach((day, dayIndex) => {
      const shift = day.shifts.find((item) => item.shiftName === shiftName);
      const slots = orderedSlots.map(({ dishSlot, slotLabel }): MrxMatrixSlotCell | null => {
        const sourceSlot = shift?.slots.find((item) => item.dishSlot === dishSlot && item.menuVariant === menuVariant);
        if (!sourceSlot) return null;
        const dishId = draft[day.serviceDate]?.[shiftName]?.dishes[dishSlot] || sourceSlot.dishId || '';
        return {
          serviceDate: day.serviceDate,
          shiftName,
          menuVariant,
          dishSlot,
          slotLabel,
          dishId,
          dishCode: sourceSlot.dishCode,
          dishName: sourceSlot.dishName,
          isLocked: day.isLocked,
          lockReason: day.lockReason,
        };
      });

      if (mode === 'dish-edit') {
        slots.forEach((slot, rowIndex) => {
          positionsByRow[rowIndex][dayIndex] = slot
            ? { kind: 'cell', cell: {
              serviceDates: [day.serviceDate], shiftName, menuVariant, slots: [slot],
              dishId: slot.dishId, dishCode: slot.dishCode, dishName: slot.dishName,
              rowSpan: 1, colSpan: 1, isLocked: slot.isLocked, lockReason: slot.lockReason,
            } }
            : { kind: 'empty', serviceDate: day.serviceDate, isLocked: day.isLocked, lockReason: day.lockReason };
        });
        return;
      }

      for (let rowIndex = 0; rowIndex < slots.length; rowIndex += 1) {
        const slot = slots[rowIndex];
        if (!slot) {
          positionsByRow[rowIndex][dayIndex] = {
            kind: 'empty', serviceDate: day.serviceDate, isLocked: day.isLocked, lockReason: day.lockReason,
          };
          continue;
        }
        const groupedSlots = [slot];
        while (
          rowIndex + groupedSlots.length < slots.length
          && slots[rowIndex + groupedSlots.length]?.dishId !== ''
          && slots[rowIndex + groupedSlots.length]?.dishId === slot.dishId
        ) {
          groupedSlots.push(slots[rowIndex + groupedSlots.length]!);
        }
        positionsByRow[rowIndex][dayIndex] = { kind: 'cell', cell: {
          serviceDates: [day.serviceDate], shiftName, menuVariant, slots: groupedSlots,
          dishId: slot.dishId, dishCode: slot.dishCode, dishName: slot.dishName,
          rowSpan: groupedSlots.length, colSpan: 1, isLocked: slot.isLocked, lockReason: slot.lockReason,
        } };
        for (let covered = 1; covered < groupedSlots.length; covered += 1) {
          positionsByRow[rowIndex + covered][dayIndex] = { kind: 'covered' };
        }
        rowIndex += groupedSlots.length - 1;
      }
    });

    if (mode === 'completion') {
      for (const positions of positionsByRow) {
        for (let dayIndex = 0; dayIndex < positions.length; dayIndex += 1) {
          const position = positions[dayIndex];
          if (position?.kind !== 'cell') continue;
          let colSpan = 1;
          while (dayIndex + colSpan < positions.length) {
            const next = positions[dayIndex + colSpan];
            if (next?.kind !== 'cell' || !sameHorizontalBlock(position.cell, next.cell)) break;
            position.cell.serviceDates.push(...next.cell.serviceDates);
            position.cell.slots.push(...next.cell.slots);
            positions[dayIndex + colSpan] = { kind: 'covered' };
            colSpan += 1;
          }
          position.cell.colSpan = colSpan;
          dayIndex += colSpan - 1;
        }
      }
    }

    const servingKey = menuVariant === 'vegetarian' ? 'vegetarianServings' : 'savoryServings';
    return {
      key: `${shiftName}-${menuVariant}`,
      label: `${variantLabel(menuVariant)} · ${shiftLabel(shiftName)}`,
      shiftName,
      menuVariant,
      servings: scope.days.map((day) => ({
        serviceDate: day.serviceDate,
        value: draft[day.serviceDate]?.[shiftName]?.[servingKey] ?? null,
        isLocked: day.isLocked,
        lockReason: day.lockReason,
      })),
      rows: orderedSlots.map((slot, rowIndex) => ({ ...slot, positions: positionsByRow[rowIndex] })),
    };
  });

  return { dates, sections };
}
