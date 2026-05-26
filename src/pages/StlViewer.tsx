import * as React from "react";
import { Link, useParams } from "react-router-dom";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { listStlFiles, getStlContent, ApiError, type StlFile } from "../services";

export function StlViewerPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · STL Viewer"
      title="3D-Vorschau"
      description="Maus: Linksklick + ziehen rotiert, Rechtsklick + ziehen verschiebt, Mausrad zoomt."
      actions={
        <Link to={Routes.Dashboard.Stl} className="btn-outline btn-sm">
          Zurück zur Liste
        </Link>
      }
    >
      {() =>
        id ? <ViewerContent fileId={id} /> : <p className="text-sm text-red-300">Keine Datei-ID.</p>
      }
    </DashboardLayout>
  );
}

interface ViewerContentProps {
  fileId: string;
}

function ViewerContent({ fileId }: ViewerContentProps) {
  const [meta, setMeta] = React.useState<StlFile | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  /** Object URL for the "Download"-button. Built lazily from the same
   *  ArrayBuffer we feed to three.js so we don't fetch the blob twice. */
  const [downloadHref, setDownloadHref] = React.useState<string | null>(null);
  /** Stats surfaced from STLLoader's parsed geometry — bbox tells the
   *  user how big the model is in printer-bed units. */
  const [stats, setStats] = React.useState<{
    triangles: number;
    sizeMm: { x: number; y: number; z: number };
  } | null>(null);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Keep meta + content fetch separate so a slow blob doesn't delay the
  // header card; meta loads from /stl (cached list call), then the
  // viewer kicks off the actual content download.
  React.useEffect(() => {
    listStlFiles()
      .then((files) => {
        const m = files.find((f) => f.id === fileId) ?? null;
        setMeta(m);
        if (!m) return;
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setMeta(null);
        } else {
          console.error(err);
          setError("Metadaten konnten nicht geladen werden.");
        }
      });
  }, [fileId]);

  /**
   * Sets up the three.js scene, fetches the STL bytes, parses + frames
   * the geometry, and wires OrbitControls. Cleanup tears the renderer
   * down so SPA navigation doesn't leak a WebGL context.
   *
   * The whole effect lives in a single body to keep all the disposable
   * resources (renderer, controls, geometry, material) close together;
   * splitting it over multiple effects would make the cleanup story
   * tricky.
   */
  React.useEffect(() => {
    if (meta === undefined || meta === null) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let objectUrl: string | null = null;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // matches slate-950

    // Camera placeholder; bbox-based reframing happens after geometry load.
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(80, 80, 80);

    // Renderer — antialias on, devicePixelRatio bounded so a 4× retina
    // panel doesn't crank the GPU for no perceptual gain on a model
    // viewer that's at most a quarter screen.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    // Lighting: hemisphere for ambient sky/ground tint, plus one
    // directional key light. Cheap, looks good on un-textured models.
    const hemi = new THREE.HemisphereLight(0xa5f3fc, 0x0f172a, 0.6);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(1, 1.4, 0.8);
    scene.add(key);

    // Grid + axes for spatial reference. Same dimming as the slate
    // theme so they don't dominate.
    const grid = new THREE.GridHelper(200, 20, 0x1e293b, 0x1e293b);
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // Resize handling — ResizeObserver hits even when the container is
    // resized by Tailwind breakpoint changes (no `resize` event then).
    function applySize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    applySize();
    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    // Render loop. `requestAnimationFrame` chained so we can cancel on
    // dispose via the `disposed` flag — not strictly required (cleanup
    // also kills the canvas) but stops the next frame from queueing.
    let frameId = 0;
    function tick() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frameId = globalThis.requestAnimationFrame(tick);
    }
    tick();

    // Fetch and load
    let geometry: THREE.BufferGeometry | null = null;
    let mesh: THREE.Mesh | null = null;
    const material = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      metalness: 0.1,
      roughness: 0.55,
      flatShading: true
    });

    setError(null);
    getStlContent(fileId)
      .then((buffer) => {
        if (disposed) return;
        // Build the download URL from the same buffer we got — saves a
        // second round-trip if the user wants the file.
        const blob = new Blob([buffer], { type: "model/stl" });
        objectUrl = URL.createObjectURL(blob);
        setDownloadHref(objectUrl);

        const loader = new STLLoader();
        geometry = loader.parse(buffer);

        // Centre on origin and reframe the camera so the model fits the
        // viewport regardless of slicer-emitted coordinates (some put
        // the part on the bed surface, others around origin).
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        mesh = new THREE.Mesh(geometry, material);
        // Re-rotate so Z-up models (Cura/Slicer convention) sit on the
        // grid plane rather than lying on their side.
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);

        // Frame: position camera at 1.8× the bounding sphere radius
        // so the whole model fits with a bit of headroom.
        const radius = size.length() / 2;
        const dist = radius * 1.8 + 20;
        camera.position.set(dist, dist, dist);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        // Surface stats. STLLoader returns a non-indexed geometry
        // where `position.count / 3` is the triangle count.
        const triCount = geometry.attributes.position.count / 3;
        setStats({
          triangles: Math.round(triCount),
          sizeMm: { x: size.x, y: size.y, z: size.z }
        });
      })
      .catch((err: unknown) => {
        if (disposed) return;
        console.error(err);
        setError(err instanceof ApiError ? err.message : "STL konnte nicht geladen werden.");
      });

    return () => {
      disposed = true;
      globalThis.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      if (mesh) scene.remove(mesh);
      if (geometry) geometry.dispose();
      material.dispose();
      renderer.dispose();
      // forceContextLoss helps tab-switch heavy users avoid the
      // browser's WebGL context limit (~16 contexts on most browsers).
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [meta, fileId]);

  if (meta === undefined && !error) return <p className="text-sm text-slate-400">Lade…</p>;
  if (meta === null) return <p className="text-sm text-slate-400">Datei nicht gefunden.</p>;
  if (!meta) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-50">{meta.originalFilename}</p>
          <p className="mt-1 text-xs text-slate-500">
            {meta.metadata.format === "binary"
              ? "Binär"
              : meta.metadata.format === "ascii"
                ? "ASCII"
                : "?"}
            {stats && (
              <>
                {" "}
                · {stats.triangles.toLocaleString("de-DE")} Tris · {stats.sizeMm.x.toFixed(1)} ×{" "}
                {stats.sizeMm.y.toFixed(1)} × {stats.sizeMm.z.toFixed(1)} mm
              </>
            )}
          </p>
        </div>
        {downloadHref && (
          <a
            href={downloadHref}
            download={meta.originalFilename}
            className="btn-outline btn-sm shrink-0"
          >
            Herunterladen
          </a>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* Viewer canvas. h-[60vh] keeps the model area dominant on phones
          without pushing the header off-screen; lg gets a bit more. */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 h-[60vh] lg:h-[70vh]"
      />
    </div>
  );
}
