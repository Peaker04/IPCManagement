export interface RecipeIngredient {
  name: string;
  amount: number; // gram per portion
}

export interface Dish {
  id: string;
  name: string;
  type: 'morning' | 'afternoon';
  category: 'savory' | 'vegetarian';
  ingredients: RecipeIngredient[];
}

export const DISHES: Dish[] = [
  {
    id: 'm1',
    name: 'Bún mọc sườn non',
    type: 'morning',
    category: 'savory',
    ingredients: [
      { name: 'Sườn heo', amount: 80 },
      { name: 'Bún tươi', amount: 150 },
      { name: 'Giò sống (mọc)', amount: 40 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'm2',
    name: 'Phở gà ta',
    type: 'morning',
    category: 'savory',
    ingredients: [
      { name: 'Thịt gà', amount: 80 },
      { name: 'Bánh phở', amount: 150 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'm3',
    name: 'Hủ tiếu Nam Vang',
    type: 'morning',
    category: 'savory',
    ingredients: [
      { name: 'Thịt heo nạc', amount: 50 },
      { name: 'Tôm tươi', amount: 30 },
      { name: 'Hủ tiếu khô', amount: 80 },
      { name: 'Giá đỗ & Hẹ', amount: 40 },
    ],
  },
  {
    id: 'a1',
    name: 'Cơm sườn rim tiêu',
    type: 'afternoon',
    category: 'savory',
    ingredients: [
      { name: 'Sườn heo', amount: 100 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Rau cải xanh', amount: 80 },
    ],
  },
  {
    id: 'a2',
    name: 'Cơm cá lóc kho tộ',
    type: 'afternoon',
    category: 'savory',
    ingredients: [
      { name: 'Cá lóc phi lê', amount: 120 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Rau muống', amount: 80 },
      { name: 'Thịt ba chỉ', amount: 20 },
    ],
  },
  {
    id: 'a3',
    name: 'Cơm gà xối mỡ',
    type: 'afternoon',
    category: 'savory',
    ingredients: [
      { name: 'Thịt gà', amount: 150 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Dưa leo & Cà chua', amount: 50 },
    ],
  },
  {
    id: 'v1',
    name: 'Mỳ chay',
    type: 'morning',
    category: 'vegetarian',
    ingredients: [
      { name: 'Mì sợi', amount: 80 },
      { name: 'Nấm đùi gà', amount: 40 },
      { name: 'Đậu phụ', amount: 50 },
      { name: 'Rau cải xanh', amount: 50 },
    ],
  },
  {
    id: 'v2',
    name: 'Bún chay',
    type: 'morning',
    category: 'vegetarian',
    ingredients: [
      { name: 'Bún tươi', amount: 150 },
      { name: 'Nấm đùi gà', amount: 40 },
      { name: 'Đậu phụ', amount: 50 },
      { name: 'Giá đỗ & Hẹ', amount: 30 },
    ],
  },
  {
    id: 'v3',
    name: 'Bún trộn chay',
    type: 'morning',
    category: 'vegetarian',
    ingredients: [
      { name: 'Bún tươi', amount: 150 },
      { name: 'Đậu phụ', amount: 60 },
      { name: 'Dưa leo & Cà chua', amount: 50 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'v4',
    name: 'Cơm chay trộn',
    type: 'afternoon',
    category: 'vegetarian',
    ingredients: [
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Nấm đùi gà', amount: 50 },
      { name: 'Đậu phụ', amount: 50 },
      { name: 'Rau cải xanh', amount: 50 },
    ],
  },
  {
    id: 'v5',
    name: 'Cơm chiên chay',
    type: 'afternoon',
    category: 'vegetarian',
    ingredients: [
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Đậu phụ', amount: 50 },
      { name: 'Dưa leo & Cà chua', amount: 50 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'v6',
    name: 'Sườn chay rim sả',
    type: 'afternoon',
    category: 'vegetarian',
    ingredients: [
      { name: 'Sườn non chay', amount: 80 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
];

export interface RawMaterial {
  name: string;
  unit: string;
  supplierA: number;
  supplierB: number;
}

export const RAW_MATERIALS: Record<string, RawMaterial> = {
  'Sườn heo': { name: 'Sườn heo', unit: 'kg', supplierA: 134000, supplierB: 128000 },
  'Bún tươi': { name: 'Bún tươi', unit: 'kg', supplierA: 12000, supplierB: 13000 },
  'Giò sống (mọc)': { name: 'Giò sống (mọc)', unit: 'kg', supplierA: 110000, supplierB: 115000 },
  'Hành lá & rau thơm': { name: 'Hành lá & rau thơm', unit: 'kg', supplierA: 25000, supplierB: 28000 },
  'Thịt gà': { name: 'Thịt gà', unit: 'kg', supplierA: 85000, supplierB: 82000 },
  'Bánh phở': { name: 'Bánh phở', unit: 'kg', supplierA: 15000, supplierB: 14000 },
  'Thịt heo nạc': { name: 'Thịt heo nạc', unit: 'kg', supplierA: 95000, supplierB: 98000 },
  'Tôm tươi': { name: 'Tôm tươi', unit: 'kg', supplierA: 180000, supplierB: 175000 },
  'Hủ tiếu khô': { name: 'Hủ tiếu khô', unit: 'kg', supplierA: 30000, supplierB: 32000 },
  'Giá đỗ & Hẹ': { name: 'Giá đỗ & Hẹ', unit: 'kg', supplierA: 18000, supplierB: 16000 },
  'Gạo tẻ': { name: 'Gạo tẻ', unit: 'kg', supplierA: 18000, supplierB: 17500 },
  'Rau cải xanh': { name: 'Rau cải xanh', unit: 'kg', supplierA: 15000, supplierB: 14000 },
  'Cá lóc phi lê': { name: 'Cá lóc phi lê', unit: 'kg', supplierA: 110000, supplierB: 115000 },
  'Rau muống': { name: 'Rau muống', unit: 'kg', supplierA: 12000, supplierB: 10000 },
  'Thịt ba chỉ': { name: 'Thịt ba chỉ', unit: 'kg', supplierA: 125000, supplierB: 120000 },
  'Dưa leo & Cà chua': { name: 'Dưa leo & Cà chua', unit: 'kg', supplierA: 16000, supplierB: 18000 },
  'Nấm đùi gà': { name: 'Nấm đùi gà', unit: 'kg', supplierA: 65000, supplierB: 60000 },
  'Đậu phụ': { name: 'Đậu phụ', unit: 'kg', supplierA: 24000, supplierB: 22000 },
  'Mì sợi': { name: 'Mì sợi', unit: 'kg', supplierA: 28000, supplierB: 25000 },
  'Sườn non chay': { name: 'Sườn non chay', unit: 'kg', supplierA: 90000, supplierB: 85000 },
};
