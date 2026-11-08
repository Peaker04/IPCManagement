import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QueryView } from '@/lib/queryView'
import { AdminEmployeesPanel } from './AdminEmployeesPanel'
import type { AdminDataPageModel } from './useAdminDataPageModel'

const ready = <T,>(data: T): QueryView<T> => ({ phase: 'ready', data, isRefreshing: false, truncation: null })

describe('AdminEmployeesPanel confirmation contract', () => {
  it('does not toggle an employee before stating login impact', () => {
    const employee = {
      userId: 'employee-1', fullName: 'Nguyễn An', username: 'nguyenan', roleId: 'role-chef', roleName: 'Chef',
      isActive: true, createdAt: '2026-07-01T00:00:00Z',
    }
    const handleEmployeeStatusToggle = vi.fn()
    const model = {
      canManageEmployees: true,
      effectiveActiveView: 'employees',
      editingEmployeeId: null,
      employeeForm: { fullName: '', username: '', password: '', roleId: 'role-chef', isActive: true },
      employeeMeta: null,
      employeeNotice: null,
      employeeRoles: [{ roleId: 'role-chef', roleName: 'Bếp trưởng', roleCode: 'CHEF' }],
      employeeRows: [employee],
      employeeSearch: '',
      handleEditEmployee: vi.fn(),
      handleEmployeeStatusToggle,
      handleEmployeeSubmit: vi.fn(),
      isEmployeeLoading: false,
      isRolesLoading: false,
      isSavingEmployee: false,
      isUpdatingStatus: false,
      queryViews: { employees: ready([employee]), roles: ready([]) },
      resetEmployeeForm: vi.fn(), setEmployeeForm: vi.fn(), setEmployeePage: vi.fn(), setEmployeeSearch: vi.fn(),
    } as unknown as AdminDataPageModel

    render(<AdminEmployeesPanel model={model} />)
    expect(screen.getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Bếp trưởng - CHEF')
    expect(screen.getByRole('combobox', { name: 'Vai trò' })).not.toHaveTextContent('role-chef')
    fireEvent.click(screen.getByRole('button', { name: 'Khóa' }))

    expect(handleEmployeeStatusToggle).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Khóa tài khoản nhân viên?' })).toHaveTextContent('Nguyễn An (nguyenan) sẽ không thể đăng nhập')
    fireEvent.click(screen.getByRole('button', { name: 'Khóa tài khoản' }))
    expect(handleEmployeeStatusToggle).toHaveBeenCalledWith(employee)
  })

  it('also confirms an active-state change submitted through the edit form', () => {
    const employee = {
      userId: 'employee-1', fullName: 'Nguyễn An', username: 'nguyenan', roleId: 'role-chef', roleName: 'Chef',
      isActive: true, createdAt: '2026-07-01T00:00:00Z',
    }
    const handleEmployeeSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    const model = {
      canManageEmployees: true, effectiveActiveView: 'employees', editingEmployeeId: employee.userId,
      employeeForm: { fullName: employee.fullName, username: employee.username, password: '', roleId: employee.roleId, isActive: false },
      employeeMeta: null, employeeNotice: null, employeeRoles: [], employeeRows: [employee], employeeSearch: '',
      handleEditEmployee: vi.fn(), handleEmployeeStatusToggle: vi.fn(), handleEmployeeSubmit,
      isEmployeeLoading: false, isRolesLoading: false, isSavingEmployee: false, isUpdatingStatus: false,
      queryViews: { employees: ready([employee]), roles: ready([]) },
      resetEmployeeForm: vi.fn(), setEmployeeForm: vi.fn(), setEmployeePage: vi.fn(), setEmployeeSearch: vi.fn(),
    } as unknown as AdminDataPageModel

    render(<AdminEmployeesPanel model={model} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    expect(handleEmployeeSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Khóa tài khoản nhân viên?' })).toHaveTextContent('Nguyễn An (nguyenan) sẽ không thể đăng nhập')
    fireEvent.click(screen.getByRole('button', { name: 'Khóa tài khoản' }))
    expect(handleEmployeeSubmit).toHaveBeenCalledOnce()
  })
})
