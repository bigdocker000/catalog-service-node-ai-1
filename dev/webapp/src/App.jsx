import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { ProductRow } from "./ProductRow";

function App() {
  const [lastRequest, setLastRequest] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [savingRecommendation, setSavingRecommendation] = useState(null);
  const [highlightedProductId, setHighlightedProductId] = useState(null);
  const [fadingOutRecommendationId, setFadingOutRecommendationId] =
    useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);

  const fetchCatalog = useCallback(() => {
    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => {
        setCatalog(data);
        setLastRequest({
          method: "GET",
          url: "/api/products",
          status: 200,
          response: data,
        });
      });
  }, []);

  const createProduct = useCallback(() => {
    fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(fetchCatalog);
  }, [fetchCatalog]);

  const deleteProduct = useCallback(
    (productId) => {
      setDeletingProductId(productId);
      fetch(`/api/products/${productId}`, {
        method: "DELETE",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to delete product (${response.status})`);
          }
          fetchCatalog();
        })
        .catch((error) => {
          console.error("Error deleting product:", error);
          alert(`Failed to delete product: ${error.message}`);
        })
        .finally(() => {
          setDeletingProductId(null);
        });
    },
    [fetchCatalog],
  );

  const addRecommendation = useCallback((product) => {
    console.log("Recommendation received:", product);

    // Debug the actual structure
    console.log("Recommendation structure:", {
      hasSourceProductId: !!product.sourceProductId,
      hasRecommendedProduct: !!product.recommendedProduct,
      recommendedProductId: product.recommendedProduct?.id,
      directId: product.id,
    });

    // Add a timestamp to make each recommendation unique
    const uniqueProduct = {
      ...product,
      _timestamp: Date.now(),
    };

    setRecommendations((prev) => [...prev, uniqueProduct]);
  }, []);

  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  const saveRecommendation = useCallback(
    (recommendation) => {
      // Use timestamp as unique identifier if available
      const savingId =
        recommendation._timestamp ||
        (recommendation.recommendedProduct &&
          recommendation.recommendedProduct.id) ||
        recommendation.id;

      setSavingRecommendation(savingId);

      // Determine the correct structure based on the recommendation object
      if (recommendation.sourceProductId && recommendation.recommendedProduct) {
        // New structure - save the recommended product first
        fetch("/api/recommended-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceProductId: recommendation.sourceProductId,
            recommendedProduct: recommendation.recommendedProduct,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              // Try to get the detailed error message from the response
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error ||
                  `Failed to save recommendation (${response.status})`,
              );
            }
            return response.json();
          })
          .then((data) => {
            // Refresh catalog and highlight the newly added product
            fetchCatalog();
            // Set the highlighted product ID (use the recommended product ID)
            const productId = data.recommendedProduct?.id || savingId;
            setHighlightedProductId(productId);

            // Mark the recommendation for fade out
            setFadingOutRecommendationId(savingId);

            // Clear highlight after 3 seconds
            setTimeout(() => {
              setHighlightedProductId(null);
            }, 3000);

            // Remove the recommendation after fade out animation completes
            setTimeout(() => {
              setRecommendations((prev) =>
                prev.filter((rec) => {
                  // If we have timestamps, use them for comparison
                  if (rec._timestamp && recommendation._timestamp) {
                    return rec._timestamp !== recommendation._timestamp;
                  }

                  // Otherwise fall back to ID comparison
                  const currentRecId = getProductProperty(rec, "id");
                  return currentRecId !== savingId;
                }),
              );
              setFadingOutRecommendationId(null);
            }, 1000);
          })
          .catch((error) => {
            console.error("Error saving recommendation:", error);
            alert(`Failed to save recommendation: ${error.message}`);
          })
          .finally(() => {
            setSavingRecommendation(null);
          });
      } else {
        // Old structure or unknown - try the old way
        // This is a fallback and might not work correctly
        alert("Cannot save this recommendation - invalid format");
        setSavingRecommendation(null);
      }
    },
    [fetchCatalog],
  );

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Helper function to safely get product properties regardless of structure
  const getProductProperty = (recommendation, property) => {
    if (
      recommendation.recommendedProduct &&
      recommendation.recommendedProduct[property] !== undefined
    ) {
      return recommendation.recommendedProduct[property];
    }
    return recommendation[property];
  };

  return (
    <>
      <h1>Demo catalog client</h1>

      {recommendations.length > 0 && (
        <div className="recommendations-container">
          <div className="recommendations-header">
            <h2>Recommended Products</h2>
            <button
              className="clear-recommendations"
              onClick={clearRecommendations}
              title="Clear recommendations"
            >
              X
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation) => {
                const id = getProductProperty(recommendation, "id");
                const isFadingOut = fadingOutRecommendationId === id;

                // Use timestamp for unique key if available
                const uniqueKey = recommendation._timestamp
                  ? `rec-${id}-${recommendation._timestamp}`
                  : `rec-${id}-${Math.random().toString(36).substr(2, 9)}`;

                return (
                  <tr
                    key={uniqueKey}
                    className={isFadingOut ? "fading-out-row" : ""}
                  >
                    <td>{id}</td>
                    <td>{getProductProperty(recommendation, "name")}</td>
                    <td>{getProductProperty(recommendation, "description")}</td>
                    <td>{getProductProperty(recommendation, "category")}</td>
                    <td>{getProductProperty(recommendation, "price")}</td>
                    <td>
                      <button
                        className="save-recommendation"
                        onClick={() => saveRecommendation(recommendation)}
                        disabled={
                          savingRecommendation ===
                            (recommendation._timestamp || id) || isFadingOut
                        }
                        title="Save recommendation"
                      >
                        {savingRecommendation ===
                        (recommendation._timestamp || id)
                          ? "..."
                          : "+"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p>
        <button onClick={fetchCatalog}>Refresh catalog</button>
        &nbsp;
        <button onClick={createProduct}>Create product</button>
      </p>

      {catalog ? (
        <>
          {catalog.length === 0 ? (
            <em>There are no products... yet!</em>
          ) : (
            <table className="full-width-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onChange={() => fetchCatalog()}
                    onRecommend={addRecommendation}
                    highlighted={product.id === highlightedProductId}
                    onDelete={deleteProduct}
                    isDeleting={deletingProductId === product.id}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p>Loading catalog...</p>
      )}
    </>
  );
}

export default App;
