/** Fallback while lazy route chunks load */
export default function PageLoader() {
  return (
    <div className="route-loader" role="status" aria-busy="true" aria-label="Loading page">
      <div className="route-loader__spinner" />
    </div>
  );
}
