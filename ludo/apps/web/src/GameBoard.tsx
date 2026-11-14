import React, { useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Board3D, type BoardPlayer, type BoardToken } from './Board3D';

export type GameBoardProps = {
  snapshot: {
    players: BoardPlayer[];
    tokens: BoardToken[][];
    currentPlayer: number;
    roomCode: string;
  };
  localSeat: number;
  rolling: boolean;
  diceDisplay: number | null;
  legal: number[];
  onTokenClick: (token: number) => void;
};

export default function GameBoard({
  snapshot,
  localSeat,
  rolling,
  diceDisplay,
  legal,
  onTokenClick,
}: GameBoardProps) {
  // Mobile portrait vs landscape viewport detection
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // On portrait mobile, expand vertical FOV and elevate camera so board edges aren't cropped
  const fov = isPortrait ? 54 : 39;
  const cameraPos: [number, number, number] = isPortrait ? [0, 16.5, 13] : [0, 13, 11];

  // High-DPI optimization: clamp device pixel ratio to [1, 1.75] to prevent mobile GPU throttling
  const dpr = useMemo<[number, number]>(() => {
    const maxDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1.5;
    return [1, maxDpr];
  }, []);

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ powerPreference: 'high-performance', antialias: true, alpha: false }}
      camera={{ position: cameraPos, fov }}
    >
      <color attach="background" args={['#312e2a']} />
      <PerspectiveCamera makeDefault position={cameraPos} fov={fov} />
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[5, 11, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Board3D
        players={snapshot.players}
        tokens={snapshot.tokens}
        currentPlayer={snapshot.currentPlayer}
        localSeat={localSeat}
        dice={diceDisplay}
        rolling={rolling}
        legalTokens={legal}
        onTokenClick={onTokenClick}
      />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={22}
        minPolarAngle={0.5}
        maxPolarAngle={1.2}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </Canvas>
  );
}
