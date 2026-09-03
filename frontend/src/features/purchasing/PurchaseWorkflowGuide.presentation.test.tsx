import { describe, expect, it } from 'vitest';
import source from './PurchaseWorkflowGuide.tsx?raw';

describe('PurchaseWorkflowGuide compact presentation', () => {
  it('keeps stage prerequisites in tooltips instead of six permanently expanded cards', () => {
    expect(source).toContain("'h-14 w-full items-center justify-start gap-2");
    expect(source).toContain("'min-w-0 flex-1 whitespace-normal text-pretty'");
    expect(source).not.toContain('flex-1 truncate');
    expect(source).toContain('title={isBlocked ? stage.blockedReason');
    expect(source).not.toContain('sm:min-h-[7.5rem]');
    expect(source).not.toContain('id={`purchasing-stage-${stage.id}-reason`}');
    expect(source).not.toContain("'Chưa mở'");
  });
});
