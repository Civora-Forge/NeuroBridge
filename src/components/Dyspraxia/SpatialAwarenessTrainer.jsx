import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DyspraxiaModule.module.css";

export default function SpatialAwarenessTrainer() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [xPosition, setXPosition] = useState(50);
  const [yPosition, setYPosition] = useState(50);

  const alignment = useMemo(() => {
    const insideX = xPosition >= 35 && xPosition <= 65;
    const insideY = yPosition >= 30 && yPosition <= 70;
    return insideX && insideY;
  }, [xPosition, yPosition]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => stopCamera, []);

  return (
    <section className={styles.card} aria-labelledby="spatial-title">
      <h2 id="spatial-title" className={styles.sectionTitle}>Spatial Awareness Trainer</h2>
      <p className={styles.helper}>Simulated alignment trainer with camera feed and frame overlays.</p>

      <div className={styles.cameraControls}>
        {!cameraActive ? (
          <button className={styles.primaryButton} onClick={startCamera}>Enable camera</button>
        ) : (
          <button className={styles.secondaryButton} onClick={stopCamera}>Disable camera</button>
        )}
      </div>

      <div className={styles.cameraFrame}>
        <video ref={videoRef} autoPlay muted playsInline className={styles.cameraVideo} />
        <div className={styles.alignmentFrame} />
        <div className={styles.bodyMarker} style={{ left: `${xPosition}%`, top: `${yPosition}%` }} aria-hidden="true" />
      </div>

      <p className={alignment ? styles.alignedText : styles.notAlignedText}>
        {alignment ? "Aligned inside frame" : "Move marker into the center frame"}
      </p>

      <div className={styles.formGrid}>
        <label className={styles.fieldLabel}>
          Horizontal alignment
          <input
            className={styles.rangeInput}
            type="range"
            min={0}
            max={100}
            value={xPosition}
            onChange={(event) => setXPosition(Number(event.target.value))}
          />
        </label>
        <label className={styles.fieldLabel}>
          Vertical alignment
          <input
            className={styles.rangeInput}
            type="range"
            min={0}
            max={100}
            value={yPosition}
            onChange={(event) => setYPosition(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
