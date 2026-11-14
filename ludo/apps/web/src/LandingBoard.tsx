import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

export default function LandingBoard() {
  const dpr = useMemo<[number, number]>(() => {
    const maxDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1.5;
    return [1, maxDpr];
  }, []);

  return (
    <Canvas shadows dpr={dpr} gl={{ antialias: true }}>
      <PerspectiveCamera makeDefault position={[0, 11, 10]} fov={42} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 9, 3]} intensity={2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[10, 0.4, 10]} />
        <meshStandardMaterial color="#efe8dc" />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.8, 8.8]} />
        <meshStandardMaterial color="#fbf8f3" />
      </mesh>
      <OrbitControls enablePan={false} minPolarAngle={0.55} maxPolarAngle={1.2} />
    </Canvas>
  );
}
