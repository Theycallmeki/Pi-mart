import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import api from "../api/axios";

export const useScanner = ({ cart, onAddToCart, onQuantityChange }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const lastScannedRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const isProcessingRef = useRef(false); // NEW: Prevent concurrent processing
  
  const [barcodeInput, setBarcodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [items, setItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [successItem, setSuccessItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [scanError, setScanError] = useState(null);

  /* LOAD ITEMS ONCE */
  useEffect(() => {
    api
      .get("/items/")
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]));
  }, []);

  /* FETCH PRODUCT */
  const fetchProduct = useCallback(
  async (barcode, { resumeScan = false } = {}) => {
    if (!barcode || isProcessingRef.current) return;

    isProcessingRef.current = true;

    try {
      const { data } = await api.get(`/items/barcode/${barcode}`);
      const product = { ...data, price: parseFloat(data.price) };

      if (product.quantity === 0) {
        setScanError(`${product.name} is out of stock`);
        isProcessingRef.current = false;
        return;
      }

      const existing = cart.find((i) => i.barcode === product.barcode);
      const cartQty = existing ? existing.quantity : 0;

      if (cartQty >= product.quantity) {
       setScanError(`Not enough stock for ${product.name}`);
        isProcessingRef.current = false;
        return;
      }

      existing
        ? onQuantityChange(product.barcode, existing.quantity + 1)
        : onAddToCart({ ...product, quantity: 1 });

      setSuccessItem(product);
      setIsScanning(false);
      setBarcodeInput("");
      setNameInput("");

      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

      scanTimeoutRef.current = setTimeout(() => {
        setSuccessItem(null);
        setSelectedItem(null);
        lastScannedRef.current = null;
        isProcessingRef.current = false;
      }, 1200);
    } catch {
      setScanError("Item not found");
      isProcessingRef.current = false;
    }
  },
  [cart, onAddToCart, onQuantityChange]
);

  /* CAMERA */
  useEffect(() => {
    if (!isScanning) {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (readerRef.current) {
        readerRef.current = null;
      }
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(null, videoRef.current, (result, error, controls) => {
        controlsRef.current = controls;
        
        if (!result) return;
        
        const code = result.getText();
        
        // Enhanced debouncing: check both last scanned AND processing state
        if (
          code && 
          code !== lastScannedRef.current && 
          !isProcessingRef.current
        ) {
          lastScannedRef.current = code;
          fetchProduct(code, { resumeScan: true });
        }
      })
      .catch((err) => {
        console.error("Scanner error:", err);
        setIsScanning(false);
      });

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [isScanning, fetchProduct]);

  /* SMART NAME SEARCH */
  const suggestions = useMemo(() => {
    if (!nameInput) return [];
    const q = nameInput.toLowerCase().trim();
    return items
      .map((i) => {
        const name = i.name.toLowerCase();
        const barcode = String(i.barcode || "");
        let score = 0;
        if (name.startsWith(q)) score = 3;
        else if (name.includes(" " + q)) score = 2;
        else if (name.includes(q)) score = 1;
        if (barcode.startsWith(q)) score = Math.max(score, 2);
        else if (barcode.includes(q)) score = Math.max(score, 1);
        return { ...i, _score: score };
      })
      .filter((i) => i._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  }, [nameInput, items]);

  return {
    videoRef,
    barcodeInput,
    setBarcodeInput,
    nameInput,
    setNameInput,
    isScanning,
    setIsScanning,
    successItem,
    fetchProduct,
    suggestions,
    selectedItem,
    setSelectedItem,
    scanError,
    setScanError,
  };
};