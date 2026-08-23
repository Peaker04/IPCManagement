import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalQueue } from "./ApprovalQueue";
import { DemandSummary } from "./DemandSummary";
import { DocumentRail } from "./DocumentRail";
import { RoleInbox } from "./RoleInbox";
import { StockMovementTable } from "./StockMovementTable";
import { ToastProvider } from "./ToastProvider";
import type {
  ApprovalRecord,
  DemandLine,
  RoleInboxItem,
  StockMovement,
  WorkflowDocument,
} from "@/types/workflow";

const roleInboxItems: RoleInboxItem[] = Array.from(
  { length: 5 },
  (_, index) => ({
    id: `task-${index + 1}`,
    laneId: "warehouse",
    owner: index === 4 ? "Thủ kho trang 2" : "Thủ kho",
    title: `Việc ${index + 1}`,
    description: `Mô tả ${index + 1}`,
    due: `Hôm nay ${index + 1}`,
    nextAction: "PENDING",
    tone: index === 1 ? "warning" : "neutral",
    route: "/warehouse",
  }),
);

const buildApproval = (
  id: string,
  title: string,
  slaDeadline?: string,
): ApprovalRecord => ({
  id,
  type: "purchase",
  title,
  source: "PR-001",
  owner: "Quản lý",
  submittedBy: "Thu mua",
  deadline: "Hôm nay",
  status: "PENDING",
  reason: "Vượt ngưỡng",
  nextAction: "Duyệt",
  tone: "warning",
  slaDeadline,
  materials: [{ name: "Gạo", quantity: 12.5, unit: "kilogram" }],
});

const movements: StockMovement[] = [
  {
    id: "m1",
    type: "receipt",
    documentNo: "inventoryreceipt-20260710-001",
    material: "Gạo tẻ",
    quantity: 50,
    beforeQty: 10,
    afterQty: 60,
    unit: "kilogram",
    owner: "Thủ kho",
    status: "RECEIVED",
    nextAction: "PENDING",
    tone: "success",
  },
  {
    id: "m2",
    type: "issue",
    documentNo: "inventoryissue-20260710-001",
    material: "Thịt gà",
    quantity: 20,
    unit: "kg",
    owner: "Thủ kho",
    status: "Đã xuất",
    nextAction: "Bếp nhận",
    tone: "neutral",
  },
];

const documents: WorkflowDocument[] = [
  {
    id: "KHSX-20260710-001",
    type: "KHSX",
    title: "Kế hoạch sản xuất",
    status: "PENDING",
    owner: "Bếp trưởng",
    summary: "Đang chờ xác nhận",
    route: "/chef-dashboard",
    lines: [{ label: "Số suất", value: "100" }],
    tone: "warning",
  },
];

const demandLines: DemandLine[] = Array.from({ length: 9 }, (_, index) => ({
  id: `demand-${index + 1}`,
  material: `Nguyên liệu ${index + 1}`,
  required: 10,
  available: 4,
  reserved: 0,
  unit: "kg",
  source: "MR-001",
  status: "Thiếu nguyên liệu",
  nextAction: "Đề xuất mua thêm",
  tone: "danger",
}));

describe("DemandSummary", () => {
  it("renders the complete server page without adding a second local pager", () => {
    render(<DemandSummary lines={demandLines} />);

    expect(
      screen.getByRole("columnheader", { name: "Hướng xử lý" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nguyên liệu 9")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Trang sau/i }),
    ).not.toBeInTheDocument();
  });

  it("supports a page-specific source column label without changing the default", () => {
    const { rerender } = render(
      <DemandSummary lines={demandLines} sourceLabel="Món ăn" />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Món ăn" }),
    ).toBeInTheDocument();

    rerender(<DemandSummary lines={demandLines} />);
    expect(
      screen.getByRole("columnheader", { name: "Nguồn" }),
    ).toBeInTheDocument();
  });

  it("renders a supplied action only for shortage rows", async () => {
    const user = userEvent.setup();
    const openPurchase = vi.fn();
    const lines = [
      demandLines[0],
      {
        ...demandLines[1],
        id: "sufficient-line",
        available: 12,
        tone: "success" as const,
        nextAction: "Tạo phiếu xuất kho",
      },
    ];

    render(
      <DemandSummary
        lines={lines}
        renderAction={(line) =>
          line.tone === "danger" ? (
            <button
              type="button"
              onClick={() => openPurchase(line.serviceDate)}
            >
              Đề xuất mua
            </button>
          ) : undefined
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Đề xuất mua" }));
    expect(openPurchase).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Xuất kho")).toBeInTheDocument();
  });
});

describe("RoleInbox", () => {
  it("renders configured empty state", () => {
    render(<RoleInbox items={[]} emptyText="Không có việc" />);

    expect(screen.getByText("Không có việc")).toBeInTheDocument();
  });

  it("paginates role work and renders action cells only when configured", async () => {
    render(
      <RoleInbox
        items={roleInboxItems}
        pageSize={4}
        actionForItem={(item) => (
          <button type="button">{item.nextAction}</button>
        )}
      />,
    );

    expect(screen.getByText("Việc 1")).toBeInTheDocument();
    expect(screen.getAllByText("PENDING")).toHaveLength(4);
    expect(screen.queryByText("Việc 5")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "PENDING" }),
    ).toHaveLength(4);

    await userEvent.click(screen.getByRole("button", { name: /Trang sau/i }));

    expect(screen.getByText("Việc 5")).toBeInTheDocument();
    expect(screen.queryByText("Việc 1")).not.toBeInTheDocument();
  });
});

describe("ApprovalQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders empty state when no approval records exist", () => {
    render(<ApprovalQueue records={[]} />);

    expect(screen.getByText("Chưa có dữ liệu để hiển thị")).toBeInTheDocument();
  });

  it("renders SLA overdue and upcoming branches", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T08:00:00+07:00"));

    render(
      <ApprovalQueue
        records={[
          buildApproval("a1", "Đơn mua quá hạn", "2026-07-10T07:00:00+07:00"),
          buildApproval("a2", "Đơn mua sắp hạn", "2026-07-10T10:30:00+07:00"),
        ]}
        pageSize={2}
        actionForRecord={(record) => (
          <button type="button">Duyệt {record.title}</button>
        )}
      />,
    );

    expect(screen.getByText("Đơn mua quá hạn")).toBeInTheDocument();
    expect(screen.getByText("Thời hạn xử lý: Quá hạn")).toBeInTheDocument();
    expect(screen.getByText("Thời hạn xử lý: 2g 30p")).toBeInTheDocument();
    expect(screen.getAllByText("Chờ duyệt")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Duyệt Đơn mua quá hạn" }),
    ).toBeInTheDocument();
  });

  it("translates technical next-action values before rendering them", () => {
    render(
      <ApprovalQueue
        records={[
          {
            ...buildApproval("a3", "Đơn mua cần xử lý"),
            nextAction: "PENDING",
          },
        ]}
        pageSize={1}
      />,
    );

    const nextAction = document.querySelector(".ipc-approval-record-action");
    expect(nextAction).toHaveTextContent("Chờ duyệt");
    expect(nextAction).not.toHaveTextContent("PENDING");
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });

  it("lets pointer and keyboard users reveal every material in a large approval", async () => {
    const materials = Array.from({ length: 7 }, (_, index) => ({
      name: `Nguyên liệu ${index + 1}`,
      quantity: index + 1,
      unit: "kg",
    }));
    render(
      <ApprovalQueue
        records={[
          { ...buildApproval("a4", "Phiếu có nhiều nguyên liệu"), materials },
        ]}
      />,
    );

    expect(screen.getByText("Nguyên liệu 4")).toBeInTheDocument();
    expect(screen.queryByText("Nguyên liệu 5")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", {
      name: "Xem thêm 3 nguyên liệu",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(screen.getByText("Nguyên liệu 7")).toBeInTheDocument();
    const collapseToggle = screen.getByRole("button", {
      name: "Thu gọn danh sách nguyên liệu",
    });
    expect(collapseToggle).toHaveAttribute("aria-expanded", "true");
    expect(collapseToggle).toHaveAttribute(
      "aria-controls",
      "approval-materials-a4",
    );
    expect(collapseToggle.closest(".ipc-approval-zone-materials-group")).toHaveClass(
      "is-expanded",
    );
  });
});

describe("DocumentRail", () => {
  it("renders owner metadata with valid description-list semantics", () => {
    render(
      <ToastProvider>
        <DocumentRail documents={documents} />
      </ToastProvider>,
    );

    const ownerTerm = screen.getByText("Người phụ trách");
    expect(ownerTerm.closest("dl")).toHaveClass("ipc-document-zone-owner");
    expect(ownerTerm.tagName).toBe("DT");
    const ownerDefinition = screen.getByText("Bếp trưởng");
    expect(ownerDefinition.tagName).toBe("DD");
    expect(ownerDefinition.closest("dl")).toHaveClass(
      "ipc-document-zone-owner",
    );
  });
});

describe("StockMovementTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state without rows", () => {
    render(
      <ToastProvider>
        <StockMovementTable movements={[]} />
      </ToastProvider>,
    );

    expect(screen.getByText("Chưa có dữ liệu để hiển thị")).toBeInTheDocument();
  });

  it("shortens known document numbers, paginates rows, and copies full document number", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ToastProvider>
        <StockMovementTable movements={movements} pageSize={1} />
      </ToastProvider>,
    );

    expect(screen.getByText("IR-20260710-001")).toBeInTheDocument();
    expect(screen.getByText("Gạo tẻ")).toBeInTheDocument();
    expect(screen.getByText("Hoàn tất")).toBeInTheDocument();
    expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();
    expect(screen.queryByText("Thịt gà")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i,
      }),
    );
    expect(writeText).toHaveBeenCalledWith("inventoryreceipt-20260710-001");
    expect(screen.getByText("Đã sao chép mã chứng từ")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i,
        }),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Trang sau/i }));

    expect(screen.getByText("II-20260710-001")).toBeInTheDocument();
    expect(screen.getByText("Thịt gà")).toBeInTheDocument();
  });

  it("preserves meaningful localized movement status and next-action text", () => {
    render(
      <ToastProvider>
        <StockMovementTable movements={[{
          ...movements[0],
          status: "Đã nhập kho",
          nextAction: "Cập nhật tồn kho",
        }]} />
      </ToastProvider>,
    );

    expect(screen.getByText("Đã nhập kho")).toBeInTheDocument();
    expect(screen.getByText("Cập nhật tồn kho")).toBeInTheDocument();
    expect(screen.queryByText("Chưa cập nhật")).not.toBeInTheDocument();
  });

  it("shows contextual feedback when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ToastProvider>
        <StockMovementTable movements={movements.slice(0, 1)} />
      </ToastProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i,
      }),
    );

    expect(
      screen.getByText("Không thể sao chép mã chứng từ"),
    ).toBeInTheDocument();
  });

  it("supports a server cursor controller without adding local pagination", async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(
      <ToastProvider>
        <StockMovementTable
          movements={movements.slice(0, 1)}
          cursorPagination={{ page: 2, hasNext: true, onNext, onPrevious }}
        />
      </ToastProvider>,
    );

    expect(screen.getByText("Dữ liệu tiếp nối")).toBeInTheDocument();
    expect(screen.getByText("Trang 2")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Trang sau/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Trang sau/i }));
    await userEvent.click(screen.getByRole("button", { name: /Trang trước/i }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("does not locally slice a server cursor page", () => {
    render(
      <ToastProvider>
        <StockMovementTable
          movements={movements}
          pageSize={1}
          cursorPagination={{
            page: 1,
            hasNext: false,
            onNext: vi.fn(),
            onPrevious: vi.fn(),
          }}
        />
      </ToastProvider>,
    );

    expect(screen.getByText("Gạo tẻ")).toBeInTheDocument();
    expect(screen.getByText("Thịt gà")).toBeInTheDocument();
    expect(
      screen.getAllByRole("navigation", { name: "Phân trang biến động kho" }),
    ).toHaveLength(1);
  });
});
