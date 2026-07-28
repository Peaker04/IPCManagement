import type { MenuDish } from './types'

export type MenuDishRole = 'main' | 'side' | 'vegetable' | 'soup' | 'fruit' | 'dessert' | 'other'

export interface MenuDishGroup {
  key: MenuDishRole
  label: string
  dishes: MenuDish[]
}

const ROLE_LABELS: Record<MenuDishRole, string> = {
  main: 'Món chính',
  side: 'Món phụ',
  vegetable: 'Rau',
  soup: 'Canh',
  fruit: 'Trái cây',
  dessert: 'Tráng miệng',
  other: 'Chưa phân loại',
}

const ROLE_ORDER: MenuDishRole[] = ['main', 'side', 'vegetable', 'soup', 'fruit', 'dessert', 'other']

const normalizeRoleSource = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const resolveRoleFromSource = (source: string): MenuDishRole | null => {
  if (!source) return null

  const slot = source.split('-').at(-1) ?? source
  if (slot === 'main' || source.includes('mon-chinh') || source.includes('mon-man-chinh')) return 'main'
  if (/^sub\d*$/.test(slot) || source.includes('mon-phu') || source.includes('side')) return 'side'
  if (slot === 'rau' || source.includes('vegetable')) return 'vegetable'
  if (slot === 'canh' || source.includes('mon-nuoc') || source.includes('soup')) return 'soup'
  if (slot === 'fruit' || source.includes('trai-cay')) return 'fruit'
  if (slot === 'dessert' || source.includes('trang-mieng') || source.includes('sua-chua')) return 'dessert'

  return null
}

export const getMenuDishRole = (dish: MenuDish): MenuDishRole => {
  const sources = [dish.dishSlot, dish.dishGroup, dish.dishType]
  for (const source of sources) {
    const role = resolveRoleFromSource(normalizeRoleSource(source))
    if (role) return role
  }
  return 'other'
}

export const getMenuDishRoleLabel = (dish: MenuDish) => ROLE_LABELS[getMenuDishRole(dish)]

export const getMenuDishSlotLabel = (dish: MenuDish) => {
  const slot = normalizeRoleSource(dish.dishSlot).split('-').at(-1)
  if (slot === 'sub1') return 'Phụ 1'
  if (slot === 'sub2') return 'Phụ 2'
  return getMenuDishRoleLabel(dish)
}

export const groupMenuDishes = (dishes: readonly MenuDish[]): MenuDishGroup[] => {
  const groups = new Map<MenuDishRole, MenuDish[]>()
  const orderedDishes = [...dishes].sort(
    (left, right) => (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER),
  )

  for (const dish of orderedDishes) {
    const role = getMenuDishRole(dish)
    groups.set(role, [...(groups.get(role) ?? []), dish])
  }

  return ROLE_ORDER.flatMap((key) => {
    const roleDishes = groups.get(key)
    return roleDishes?.length ? [{ key, label: ROLE_LABELS[key], dishes: roleDishes }] : []
  })
}
