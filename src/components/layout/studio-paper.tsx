"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Decorative only: the real CV renderer remains isolated from this scene. */
export function StudioPaper({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose = () => {};
    void Promise.all([import("three"), import("gsap")])
      .then(([THREE, { gsap }]) => {
        if (cancelled) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        } catch {
          return; // The CSS paper stack is the permanent non-WebGL fallback.
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
        camera.position.set(0, 0, 8.7);
        scene.add(new THREE.AmbientLight(0xffffff, 2.5));
        const light = new THREE.DirectionalLight(0xffffff, 4);
        light.position.set(-3, 5, 6);
        scene.add(light);
        const stack = new THREE.Group();
        stack.rotation.set(-0.18, -0.38, -0.16);
        scene.add(stack);
        const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
        const materials: InstanceType<typeof THREE.Material>[] = [];
        const box = (w: number, h: number, d: number, color: number) => {
          const geometry = new THREE.BoxGeometry(w, h, d);
          const material = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
          geometries.push(geometry);
          materials.push(material);
          return new THREE.Mesh(geometry, material);
        };
        for (let index = 0; index < 3; index++) {
          const page = new THREE.Group();
          page.add(box(2.1, 2.97, 0.045, index === 0 ? 0x242c29 : 0xfffcf3));
          page.position.set((index - 1) * 0.28, (index - 1) * 0.04, index * 0.2);
          page.rotation.z = (index - 1) * 0.14;
          stack.add(page);
          if (index === 2) {
            const title = box(1.12, 0.15, 0.012, 0x282f2b);
            title.position.set(-0.22, 0.98, 0.03);
            page.add(title);
            const accent = box(0.55, 0.055, 0.012, 0xc64b26);
            accent.position.set(-0.5, 0.72, 0.03);
            page.add(accent);
            for (let line = 0; line < 12; line++) {
              const heading = line % 4 === 0;
              const width = heading ? 0.65 : line % 3 === 0 ? 1.05 : 1.55;
              const rule = box(width, heading ? 0.055 : 0.025, 0.01, heading ? 0x62665d : 0xbfc1b7);
              rule.position.set(-0.78 + width / 2, 0.35 - line * 0.13, 0.031);
              page.add(rule);
            }
          }
        }
        const render = () => renderer.render(scene, camera);
        const resize = () => {
          const { width, height } = element.getBoundingClientRect();
          if (!width || !height) return;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          render();
        };
        element.appendChild(renderer.domElement);
        element.dataset.ready = "true";
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const pointer = matchMedia("(hover: hover) and (pointer: fine)");
        const settle = () => {
          gsap.killTweensOf(stack.rotation);
          if (motion.matches) {
            stack.rotation.set(-0.18, -0.38, -0.16);
            render();
          } else {
            gsap.to(stack.rotation, {
              x: -0.18,
              y: -0.38,
              duration: 0.25,
              ease: "power3.out",
              onUpdate: render,
            });
          }
        };
        const move = (event: PointerEvent) => {
          if (motion.matches || !pointer.matches) return;
          const rect = element.getBoundingClientRect();
          gsap.to(stack.rotation, {
            x: -0.18 + ((event.clientY - rect.top) / rect.height - 0.5) * 0.22,
            y: -0.38 + ((event.clientX - rect.left) / rect.width - 0.5) * 0.5,
            duration: 0.25,
            ease: "power3.out",
            overwrite: true,
            onUpdate: render,
          });
        };
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerleave", settle);
        motion.addEventListener("change", settle);
        const contextLost = (event: Event) => {
          event.preventDefault();
          element.dataset.ready = "false";
          gsap.killTweensOf(stack.rotation);
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLost);
        dispose = () => {
          observer.disconnect();
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerleave", settle);
          motion.removeEventListener("change", settle);
          gsap.killTweensOf(stack.rotation);
          geometries.forEach((geometry) => geometry.dispose());
          materials.forEach((material) => material.dispose());
          renderer.dispose();
          renderer.domElement.remove();
          delete element.dataset.ready;
        };
      })
      .catch(() => {
        /* Keep the static paper fallback if a lazy chunk is unavailable. */
      });
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <div ref={host} aria-hidden="true" className={cn("studio-paper", className)}>
      <div className="studio-paper-fallback">
        <span />
        <span />
        <span>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
