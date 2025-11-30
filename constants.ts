
import { Product, Warehouse, InventoryRecord, Transaction, SaleType, ShippingMethod, Dealer } from './types';

// 定義經銷商
export const INITIAL_DEALERS: Dealer[] = [
  { id: 'd-001', name: '宏達科技', contactPerson: '陳經理', taxId: '12345678', email: 'sales@hitech.com.tw' },
  { id: 'd-002', name: '全台3C通路', contactPerson: '林小姐', taxId: '87654321', email: 'order@retail.com.tw' },
  { id: 'd-003', name: '大發工作室', contactPerson: '王大明', taxId: '22334455', email: 'studio@dafa.tw' },
];

// 定義倉庫 (包含公司內倉 + 經銷商外倉)
export const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'wh-main', name: '台北總部 (總倉)', location: 'Taipei City', type: 'Internal' },
  // 對應 d-001
  { id: 'wh-dealer-d-001', name: '宏達科技 (寄賣倉)', location: 'Dealer Site', type: 'External' },
  // 對應 d-002
  { id: 'wh-dealer-d-002', name: '全台3C (寄賣倉)', location: 'Dealer Site', type: 'External' },
];

export const INITIAL_PRODUCTS: Product[] = [
  { 
    id: 'p-001', 
    sku: 'ELEC-GPU-4090', 
    barcode: '4719072964881', 
    name: 'RTX 4090 顯示卡', 
    category: '電子產品', 
    priceRetail: 52000,
    priceMOQ1: 50000,
    priceMOQ2: 48000,
    minStock: 10
  },
  { 
    id: 'p-002', 
    sku: 'ELEC-CPU-14900', 
    barcode: '5032037234567', 
    name: 'Intel i9-14900K', 
    category: '電子產品', 
    priceRetail: 18500,
    priceMOQ1: 17800,
    priceMOQ2: 17000,
    minStock: 20
  },
  { 
    id: 'p-003', 
    sku: 'FURN-DESK-PRO', 
    barcode: '8809485721123', 
    name: '電動升降桌 Pro', 
    category: '辦公家具', 
    priceRetail: 12000,
    priceMOQ1: 11000,
    priceMOQ2: 10500,
    minStock: 5
  },
  { 
    id: 'p-004', 
    sku: 'FURN-CHAIR-ULTRA', 
    barcode: '8809485721124', 
    name: '人體工學椅 Ultra', 
    category: '辦公家具', 
    priceRetail: 8500,
    priceMOQ1: 7800,
    priceMOQ2: 7200,
    minStock: 15
  },
  { 
    id: 'p-005', 
    sku: 'ACC-MOU-WL', 
    barcode: '6921384729102', 
    name: '無線電競滑鼠', 
    category: '周邊配件', 
    priceRetail: 2400,
    priceMOQ1: 2200,
    priceMOQ2: 2000,
    minStock: 50
  },
];

export const INITIAL_INVENTORY: InventoryRecord[] = [
  // 總倉庫存
  { productId: 'p-001', warehouseId: 'wh-main', quantity: 2 }, 
  { productId: 'p-002', warehouseId: 'wh-main', quantity: 0 },
  { productId: 'p-003', warehouseId: 'wh-main', quantity: 5 },
  { productId: 'p-004', warehouseId: 'wh-main', quantity: 20 },
  { productId: 'p-005', warehouseId: 'wh-main', quantity: 200 },

  // 宏達科技 (寄賣倉)
  { productId: 'p-001', warehouseId: 'wh-dealer-d-001', quantity: 5 },
  { productId: 'p-002', warehouseId: 'wh-dealer-d-001', quantity: 10 },

  // 全台3C (寄賣倉)
  { productId: 'p-003', warehouseId: 'wh-dealer-d-002', quantity: 8 },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1001',
    date: '2023-10-25',
    dealerId: 'd-001',
    dealerName: '宏達科技',
    saleType: SaleType.CONSIGNMENT, // 寄賣調撥
    shippingMethod: ShippingMethod.TRUCK,
    shippingCost: 0,
    totalValue: 250000,
    items: [
        { productId: 'p-001', quantity: 5, warehouseId: 'wh-main', targetWarehouseId: 'wh-dealer-d-001', priceAtSale: 50000 }
    ],
    note: '首次鋪貨'
  },
  {
    id: 'tx-1002',
    date: '2023-10-28',
    dealerId: 'd-001',
    dealerName: '宏達科技',
    saleType: SaleType.CONSIGNMENT_SOLD, // 回報售出
    shippingMethod: ShippingMethod.NONE,
    shippingCost: 0,
    totalValue: 50000,
    items: [
        { productId: 'p-001', quantity: 1, warehouseId: 'wh-dealer-d-001', priceAtSale: 50000 }
    ],
    note: '十月份結算 - 售出一張顯卡'
  }
];
