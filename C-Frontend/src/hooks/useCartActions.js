export const useCartActions = (setCart) => {
  const addToCart = (product) => {
    const normalized = {
      ...product,
      price: typeof product.price === 'number' ? product.price : parseFloat(product.price || 0)
    };
    
    setCart((prev) =>
      prev.find((i) => i.barcode === normalized.barcode)
        ? prev.map((i) =>
            i.barcode === normalized.barcode
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...prev, { ...normalized, quantity: 1 }]
    );
  };

  const changeQuantity = (barcode, qty, maxStock) => {
    setCart((prev) =>
      prev.map((i) =>
        i.barcode === barcode
          ? { ...i, quantity: Math.min(Math.max(1, qty), maxStock ?? qty) }
          : i
      )
    );
  };

  const deleteItem = (barcode) => {
    setCart((prev) => prev.filter((i) => i.barcode !== barcode));
  };

  return {
    addToCart,
    changeQuantity,
    deleteItem,
  };
};


//rebuild
