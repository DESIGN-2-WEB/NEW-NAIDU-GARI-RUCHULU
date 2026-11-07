/** Shown only when the restaurant settings cannot be loaded and this device
 *  has never loaded them before (see main.jsx). */
export default function StartupError() {
  return (
    <main className="startup-message">
      <h1>Cannot reach the restaurant server</h1>
      <p>The restaurant details could not be loaded. Check the internet connection, then try again.</p>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
    </main>
  );
}
