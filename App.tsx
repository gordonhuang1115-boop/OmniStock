import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InventoryView } from './components/InventoryView';
import { ShipmentHistory } from './components/ShipmentHistory';
import { ShipmentForm } from './components/ShipmentForm';
import { CustomerList } from './components/CustomerList';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_WAREHOUSES, 
  INITIAL_INVENTORY, 
  INITIAL_TRANSACTIONS,
  INITIAL_DEALERS
} from './constants';
import { Transaction, InventoryRecord, Dealer, Product, SaleType, Warehouse } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory' | 'shipments' | 'dealers'>('dashboard');
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);

  // Application State
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [inventory, setInventory] = useState<InventoryRecord[]>(INITIAL_INVENTORY);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [customers, setCustomers] = useState<Dealer[]>(INITIAL_DEALERS);

  // Handle New Shipment (Buyout, Consignment Transfer, Consignment Sold)
  const handleNewTransaction = (transaction: Transaction) => {
    // 1. Handle Dynamic Warehouse Creation for Consignment Transfer (Fallback)
    // Even though we now create warehouses when adding dealers, this is a safety check.
    if (transaction.saleType === SaleType.CONSIGNMENT) {
        const dealerWhId = `wh-dealer-${transaction.dealerId}`;
        const warehouseExists = warehouses.find(w => w.id === dealerWhId);

        if (!warehouseExists) {
            const dealer = customers.find(c => c.id === transaction.dealerId);
            if (dealer) {
                const newWarehouse: Warehouse = {
                    id: dealerWhId,
                    name: `${dealer.name} (寄賣倉)`,
                    location: 'Dealer Location',
                    type: 'External'
                };
                setWarehouses(prev => [...prev, newWarehouse]);
            }
        }
        
        // Ensure all items in this transaction target this dealer warehouse
        transaction.items.forEach(item => {
            if (!item.targetWarehouseId) {
                item.targetWarehouseId = dealerWhId;
            }
        });
    }

    setTransactions(prev => [transaction, ...prev]);

    const newInventory = [...inventory];

    transaction.items.forEach(item => {
      // 2. DEDUCT from Source Warehouse
      const sourceIndex = newInventory.findIndex(
        r => r.productId === item.productId && r.warehouseId === item.warehouseId
      );

      if (sourceIndex !== -1) {
        newInventory[sourceIndex] = {
          ...newInventory[sourceIndex],
          quantity: newInventory[sourceIndex].quantity - item.quantity
        };
      } else {
        // If record doesn't exist but we are deducting (allow negative for temporary tracking)
        newInventory.push({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: -item.quantity
        });
      }

      // 3. IF Consignment Transfer -> ADD to Target Warehouse (Dealer Warehouse)
      if (transaction.saleType === SaleType.CONSIGNMENT && item.targetWarehouseId) {
         const targetIndex = newInventory.findIndex(
             r => r.productId === item.productId && r.warehouseId === item.targetWarehouseId
         );

         if (targetIndex !== -1) {
             // Add to existing record
             newInventory[targetIndex] = {
                 ...newInventory[targetIndex],
                 quantity: newInventory[targetIndex].quantity + item.quantity
             };
         } else {
             // Create new record in target warehouse
             newInventory.push({
                 productId: item.productId,
                 warehouseId: item.targetWarehouseId,
                 quantity: item.quantity
             });
         }
      }
    });

    setInventory(newInventory);
    setCurrentView('shipments');
  };

  const handleUpdateTransactionNote = (id: string, note: string) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, note } : tx));
  };

  const handleAddDealer = (dealer: Dealer) => {
    // 1. Add Dealer
    setCustomers(prev => [...prev, dealer]);
    
    // 2. Automatically Create a Consignment Warehouse for this Dealer
    const newWarehouse: Warehouse = {
        id: `wh-dealer-${dealer.id}`,
        name: `${dealer.name} (寄賣倉)`,
        location: 'Dealer Site',
        type: 'External'
    };
    setWarehouses(prev => [...prev, newWarehouse]);
  };

  const handleUpdateDealer = (updatedDealer: Dealer) => {
    // 1. Update Dealer List
    setCustomers(prev => prev.map(d => d.id === updatedDealer.id ? updatedDealer : d));

    // 2. Sync Warehouse Name (if dealer name changed)
    const dealerWhId = `wh-dealer-${updatedDealer.id}`;
    setWarehouses(prev => prev.map(w => {
        if (w.id === dealerWhId) {
            return { ...w, name: `${updatedDealer.name} (寄賣倉)` };
        }
        return w;
    }));
  };

  const handleDeleteDealer = (id: string) => {
    if (confirm('確定要刪除這位經銷商嗎？相關的歷史訂單保留，但無法再建立新訂單。')) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      // Optional: We could mark the warehouse as inactive, but for now we keep it to show historical data if needed.
    }
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts(prev => [...prev, newProduct]);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  // Manual Inventory Correction
  const handleUpdateInventoryQuantity = (productId: string, warehouseId: string, newQty: number) => {
    setInventory(prev => {
        const idx = prev.findIndex(r => r.productId === productId && r.warehouseId === warehouseId);
        if (idx !== -1) {
            const newInv = [...prev];
            newInv[idx] = { ...newInv[idx], quantity: newQty };
            return newInv;
        } else {
            return [...prev, { productId, warehouseId, quantity: newQty }];
        }
    });
  };

  const handleBatchUpdateInventory = (updates: {sku: string, name: string, qty: number, warehouseId: string, retail?: number, moq1?: number, moq2?: number}[]) => {
      const newInventory = [...inventory];
      const newProducts = [...products];
      
      let updatedCount = 0;

      updates.forEach(update => {
          const productIndex = newProducts.findIndex(p => p.sku === update.sku);
          if (productIndex === -1) return; // Skip invalid SKU (Or create? for now skip to keep safe)

          // Update Metadata (Name, Prices)
          const currentProd = newProducts[productIndex];
          newProducts[productIndex] = {
             ...currentProd,
             name: update.name || currentProd.name, // Update Name if provided
             priceRetail: update.retail || currentProd.priceRetail,
             priceMOQ1: update.moq1 || currentProd.priceMOQ1,
             priceMOQ2: update.moq2 || currentProd.priceMOQ2,
          };

          // Update Inventory (Add)
          const product = newProducts[productIndex];
          const invIndex = newInventory.findIndex(i => i.productId === product.id && i.warehouseId === update.warehouseId);
          
          if (invIndex !== -1) {
              newInventory[invIndex] = { 
                  ...newInventory[invIndex], 
                  quantity: newInventory[invIndex].quantity + update.qty 
              };
          } else {
              newInventory.push({
                  productId: product.id,
                  warehouseId: update.warehouseId,
                  quantity: update.qty
              });
          }
          updatedCount++;
      });

      setProducts(newProducts);
      setInventory(newInventory);
      alert(`已成功更新 ${updatedCount} 筆商品資料 (含庫存與價格)！`);
  };

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-[#2C3333] flex font-sans">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      {/* 
         Mobile Layout Adjustments:
         1. ml-0 on mobile, md:ml-64 on desktop
         2. pb-24 on mobile to prevent content hidden behind bottom nav
      */}
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 overflow-y-auto min-h-screen pb-28 md:pb-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-6 md:mb-8 animate-fade-in-down">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#2C3333] tracking-tight">
              {currentView === 'dashboard' && '營運總覽'}
              {currentView === 'inventory' && '庫存管理'}
              {currentView === 'shipments' && '出貨紀錄'}
              {currentView === 'dealers' && '經銷商管理'}
            </h1>
            <div className="h-1 w-20 bg-[#A5C9CA] mt-2 rounded-full"></div>
          </div>

          <div className="animate-fade-in-up">
            {currentView === 'dashboard' && (
              <Dashboard 
                products={products}
                warehouses={warehouses}
                inventory={inventory}
                transactions={transactions}
                onQuickAdd={() => setIsShipmentModalOpen(true)}
              />
            )}
            
            {currentView === 'inventory' && (
              <InventoryView 
                products={products}
                warehouses={warehouses}
                inventory={inventory}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onUpdateInventoryQuantity={handleUpdateInventoryQuantity}
                onBatchUpdateInventory={handleBatchUpdateInventory}
              />
            )}

            {currentView === 'shipments' && (
              <ShipmentHistory 
                transactions={transactions}
                products={products}
                warehouses={warehouses}
                onOpenNew={() => setIsShipmentModalOpen(true)}
                onUpdateNote={handleUpdateTransactionNote}
                customers={customers}
              />
            )}

            {currentView === 'dealers' && (
              <CustomerList 
                customers={customers}
                transactions={transactions}
                products={products}
                inventory={inventory}
                onAddCustomer={handleAddDealer}
                onUpdateCustomer={handleUpdateDealer}
                onDeleteCustomer={handleDeleteDealer}
              />
            )}
          </div>
        </div>
      </main>

      <ShipmentForm 
        isOpen={isShipmentModalOpen}
        onClose={() => setIsShipmentModalOpen(false)}
        products={products}
        warehouses={warehouses}
        customers={customers}
        currentInventory={inventory}
        onSubmit={handleNewTransaction}
      />
    </div>
  );
};

export default App;