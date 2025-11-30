
export enum SaleType {
  BUYOUT = '買斷',
  CONSIGNMENT = '寄賣出貨 (調撥)',
  CONSIGNMENT_SOLD = '寄賣結算 (回報售出)'
}

export enum ShippingMethod {
  TRUCK = '貨運',
  COURIER = '快遞 (順豐/黑貓)',
  POSTAL = '郵局',
  PICKUP = '自取',
  NONE = '無 (帳務處理)'
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  type: 'Internal' | 'External';
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  
  // 價格體系 (未稅)
  priceRetail: number; // 散貨價格
  priceMOQ1: number;   // 批發價 1
  priceMOQ2: number;   // 批發價 2
  
  // 庫存設定
  minStock: number;    // 安全庫存水位
}

export interface Dealer { // 原 Customer 改為 Dealer
  id: string;
  name: string;
  contactPerson: string; // 新增聯絡人
  taxId: string;
  email: string;
}

export interface InventoryRecord {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  quantity: number;
  warehouseId: string;
  priceAtSale: number; // 紀錄當下成交單價
  // Added optional targetWarehouseId for consignment transfers
  targetWarehouseId?: string;
}

export interface Transaction {
  id: string;
  date: string;
  dealerId: string; // CustomerId -> DealerId
  dealerName: string;
  saleType: SaleType;
  shippingMethod: ShippingMethod;
  shippingCost: number; // 新增運費
  items: TransactionItem[];
  totalValue: number; // 商品總額 (不含運費)
  note?: string; // 備註 / 物流單號
}

// 報表用的介面
export interface BillingStatement {
  dealer: Dealer;
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  totalGoodsAmount: number; // 商品小計
  totalShipping: number;    // 運費小計
  taxAmount: number;        // 稅金 (5%)
  grandTotal: number;       // 總計
}
