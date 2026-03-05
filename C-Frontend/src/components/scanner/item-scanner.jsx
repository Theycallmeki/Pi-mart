import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCartShopping,
  faPaperclip,
} from "@fortawesome/free-solid-svg-icons";

import { useScanner } from "../../hooks/useScanner";
import { useCartActions } from "../../hooks/useCartActions";
import "./styles.css";

const PageWrapper = ({ children }) => (
  <div className="page-wrapper">{children}</div>
);

const Section = ({ children }) => (
  <div
    style={{
      padding: 24,
      borderRadius: 16,
      background: "#ffffff",
      border: "1px solid #E5E7EB",
      boxShadow: "0 6px 16px rgba(0,0,0,.1)",
    }}
  >
    {children}
  </div>
);

const PrimaryButton = ({ children, onClick, style }) => (
  <button
    onClick={onClick}
    style={{
      background: "#ea1e25",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "12px 18px",
      fontWeight: 500,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    {children}
  </button>
);

const Scanner = ({ cart, setCart }) => {
  const navigate = useNavigate();
  const { addToCart, changeQuantity, deleteItem } =
    useCartActions(setCart);

  const {
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
    setScanError
  } = useScanner({
    cart,
    onAddToCart: addToCart,
    onQuantityChange: changeQuantity,
  });

  return (
    <PageWrapper>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 5,
          fontSize: 14,
        }}
      >
        <PrimaryButton
          onClick={() => navigate("/best")}
        >
          Recommendations
        </PrimaryButton>

        <PrimaryButton
          onClick={() => navigate("/cart")}
        >
          <FontAwesomeIcon icon={faCartShopping} />
          Go to Cart
        </PrimaryButton>
      </div>
      <h2 style={{ color: "#000", marginTop: 24 }}>
        Search or Scan Products
      </h2>

      <div className="scanner-layout">
        {/* LEFT COLUMN */}
        <div className="scanner-column">
          <Section>
            {scanError && <p className="scan-error">{scanError}</p>}
            <div className="scanner-actions unified-search">
              <div className="search-input-wrapper">
                <input
                  className="scanner-input unified-input"
                  value={selectedItem ? selectedItem.name : nameInput || barcodeInput}
                  onChange={(e) => {
                    setBarcodeInput(e.target.value);
                    setNameInput(e.target.value);
                    setSelectedItem(null);
                    setScanError(null);
                  }}
                  placeholder="Search product name/barcode"
                />

                {nameInput && suggestions.length > 0 && (
                  <div className="suggestions">
                    {suggestions.map((item) => (
                      <div
                        key={item.barcode}
                        className="suggestion-item"
                        onClick={() => {
                          setBarcodeInput(item.barcode);
                          setSelectedItem(item);
                          setNameInput("");
                        }}
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <PrimaryButton onClick={() => fetchProduct(barcodeInput)}>
                Add
              </PrimaryButton>
              <p className="scanner-actions separation">or</p>
              <button
                className="camera-icon-btn"
                onClick={() => setIsScanning((s) => !s)}
                type="button"
              >
                {isScanning ? (
                  <>
                    <span>✕</span>
                    Close
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCamera} />
                    Scan
                  </>
                )}
              </button>
            </div>

            {isScanning && (
              <div className="scanner-video-wrapper">
                <video ref={videoRef} className="scanner-video" />
                <div className="barcode-overlay">
                  <div className="barcode-box" />
                </div>
              </div>
            )}

          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="scanner-column">
          <Section>
            <h3 style={{ color: "#000" }}>
              <FontAwesomeIcon icon={faPaperclip} /> Added Items
            </h3>

            {!cart.length ? (
              <p style={{ color: "#6B7280" }}>No items yet...</p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.barcode}
                  style={{
                    borderBottom: "1px solid #E5E7EB",
                    padding: "12px 0",
                  }}
                >
                  <strong>{item.name}</strong>
                  <p>₱{item.price.toFixed(2)}</p>
                  <p style={{ color: "#6B7280" }}>{item.category}</p>

                  <PrimaryButton
                    onClick={() => deleteItem(item.barcode)}
                    style={{ background: "#ea1e25" }}
                  >
                    Remove
                  </PrimaryButton>
                </div>
              ))
            )}
          </Section>
        </div>
      </div>

      {successItem && (
        <div className="success-modal">
          <div className="success-box">
            <h3>Item Added</h3>
            <strong>{successItem.name}</strong>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default Scanner;