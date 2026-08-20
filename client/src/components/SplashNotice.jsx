import { useEffect, useState } from 'react';

// Storage notice shown over a blurred dashboard on load. Auto-dismisses after
// DURATION_MS; clicking or pressing a key skips it, so it never gets in the
// way of someone who already knows.
const DURATION_MS = 5000;

export default function SplashNotice({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Fade out slightly before unmounting so the blur doesn't snap away.
    const fade = setTimeout(() => setLeaving(true), DURATION_MS - 350);
    const done = setTimeout(onDone, DURATION_MS);
    const skip = () => {
      setLeaving(true);
      setTimeout(onDone, 200);
    };
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <div
      className={`splash ${leaving ? 'leaving' : ''}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        setLeaving(true);
        setTimeout(onDone, 200);
      }}
    >
      <div className="splash-card">
        <h1 className="splash-brand">
          Chakri<span>Chai</span>
        </h1>
        <p className="splash-message">
          This website saves your <strong>saved jobs</strong> and <strong>applied jobs</strong> in
          your browser's local storage — not on a server. Clearing your browser storage, or
          opening the site in another browser or device, will reset them.
        </p>
        <div className="splash-bar">
          <span className="splash-bar-fill" />
        </div>
        <p className="splash-skip">Loading your dashboard… (click to skip)</p>
      </div>
    </div>
  );
}
