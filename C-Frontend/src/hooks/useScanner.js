import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import api from "../api/axios";

export const useScanner = ({ cart, onAddToCart, onQuantityChange }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const scanLockRef = useRef(false);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [items, setItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [successItem, setSuccessItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    api
      .get("/items/")
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]));
  }, []);

  const fetchProduct = useCallback(
    async (barcode, fromCamera = false) => {
      if (!barcode || scanLockRef.current) return;

      scanLockRef.current = true;
      setIsLocked(true);

      try {
        const { data } = await api.get(`/items/barcode/${barcode}`);
        const product = { ...data, price: parseFloat(data.price) };

        if (product.quantity === 0) {
          setScanError(`${product.name} is out of stock`);
          setTimeout(() => {
            setScanError(null);
            scanLockRef.current = false;
            setIsLocked(false);
          }, 2000);
          return;
        }

        const existing = cart.find((i) => i.barcode === product.barcode);
        const cartQty = existing ? existing.quantity : 0;

        if (cartQty >= product.quantity) {
          setScanError(`Not enough stock for ${product.name}`);
          setTimeout(() => {
            setScanError(null);
            scanLockRef.current = false;
            setIsLocked(false);
          }, 2000);
          return;
        }

        existing
          ? onQuantityChange(product.barcode, existing.quantity + 1)
          : onAddToCart({ ...product, quantity: 1 });

        setSuccessItem(product);
        setBarcodeInput("");
        setNameInput("");

        if (fromCamera) {
          setIsScanning(false);
        }

        setTimeout(() => {
          setSuccessItem(null);
          setSelectedItem(null);
          scanLockRef.current = false;
          setIsLocked(false);
          if (fromCamera) {
            setIsScanning(true);
          }
        }, 1200);
      } catch {
        setScanError("Item not found");
        setTimeout(() => {
          setScanError(null);
          scanLockRef.current = false;
          setIsLocked(false);
        }, 2000);
      }
    },
    [cart, onAddToCart, onQuantityChange]
  );

  useEffect(() => {
    if (!isScanning) {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(null, videoRef.current, (result, error, controls) => {
      controlsRef.current = controls;

      if (!result) return;

      const code = result.getText();

      if (!scanLockRef.current) {
        fetchProduct(code, true);
      }
    });

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [isScanning, fetchProduct]);

  const suggestions = useMemo(() => {
    if (!nameInput) return [];
    const q = nameInput.toLowerCase().trim();

    return items
      .map((i) => {
        const name = i.name.toLowerCase();
        const barcode = String(i.barcode || "");

        let score = 0;

        if (name.startsWith(q)) score = 3;
        else if (name.includes(q)) score = 1;

        if (barcode.startsWith(q)) score = Math.max(score, 2);

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

