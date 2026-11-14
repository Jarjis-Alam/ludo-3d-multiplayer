import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type BoardToken = { kind: string; progress: number };
export type BoardPlayer = { color: string; name: string };
export type BoardProps = {
  players: BoardPlayer[];
  tokens: BoardToken[][];
  currentPlayer: number;
  localSeat: number;
  dice: number | null;
  legalTokens: number[];
  rolling?: boolean;
  onTokenClick: (token: number) => void;
  onDiceSettled?: () => void;
};

const palette: Record<string, string> = {
  red: '#e94b4b',
  green: '#36b96b',
  yellow: '#f4c542',
  blue: '#4389e8',
};

const offsets = [0, 13, 26, 39];
const safe = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function pathCell(index: number): [number, number] {
  const side = Math.floor(index / 13);
  const i = index % 13;
  if (side === 0) return [-6 + i, -6];
  if (side === 1) return [6, -6 + i];
  if (side === 2) return [6 - i, 6];
  return [-6, 6 - i];
}

function worldFor(seat: number, token: BoardToken, tokenIndex: number): [number, number, number] {
  const baseSlots = [
    [[-4.2, -4.2], [-2.8, -4.2], [-4.2, -2.8], [-2.8, -2.8]],
    [[2.8, -4.2], [4.2, -4.2], [2.8, -2.8], [4.2, -2.8]],
    [[2.8, 2.8], [4.2, 2.8], [2.8, 4.2], [4.2, 4.2]],
    [[-4.2, 2.8], [-2.8, 2.8], [-4.2, 4.2], [-2.8, 4.2]],
  ];
  if (token.kind === 'base') {
    const [x, z] = baseSlots[seat][tokenIndex];
    return [x, 0.62, z];
  }
  if (token.kind === 'home') {
    const [sx, sz] = pathCell(offsets[seat]);
    const t = Math.min(1, (token.progress + 1) / 7);
    return [sx * (1 - t), 0.75, sz * (1 - t)];
  }
  const [x, z] = pathCell((offsets[seat] + token.progress) % 52);
  return [x, 0.72, z];
}

function Token({
  token,
  seat,
  index,
  selected,
  clickable,
  onClick,
}: {
  token: BoardToken;
  seat: number;
  index: number;
  selected: boolean;
  clickable: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const target = useMemo(() => new THREE.Vector3(...worldFor(seat, token, index)), [seat, token.kind, token.progress, index]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.lerp(target, Math.min(1, delta * 10));
      if (selected) {
        // Dynamic bounce and rotation for legal tokens
        ref.current.rotation.y += delta * 1.8;
        ref.current.position.y = target.y + Math.sin(state.clock.elapsedTime * 6) * 0.08;
      } else {
        ref.current.rotation.y += delta * 0.35;
        ref.current.position.y = target.y;
      }
    }
  });

  const color = palette[['red', 'green', 'yellow', 'blue'][seat]];

  const handlePointerDown = (e: any) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: any) => {
    if (!pointerStart.current) return;
    const dist = Math.hypot(e.clientX - pointerStart.current.x, e.clientY - pointerStart.current.y);
    pointerStart.current = null;
    // Disambiguate tap vs camera orbit drag: only trigger if touch moved < 10px
    if (dist < 10) {
      e.stopPropagation();
      if (clickable) onClick();
    }
  };

  return (
    <group
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => {
        if (clickable) {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.28, 0.55, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.22}
          emissive={selected ? color : '#000000'}
          emissiveIntensity={selected ? 0.7 : 0}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.2} />
      </mesh>

      {/* Enlarged invisible touch hitbox for mobile precision */}
      <mesh visible={false}>
        <cylinderGeometry args={[0.65, 0.65, 1.2, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {selected && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27, 0]}>
            <ringGeometry args={[0.42, 0.62, 32]} />
            <meshBasicMaterial color="#fff7da" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <coneGeometry args={[0.14, 0.25, 12]} rotation={[Math.PI, 0, 0]} />
            <meshStandardMaterial color="#fff7da" emissive="#f4c542" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (rolling) {
      ref.current.rotation.x += delta * 9;
      ref.current.rotation.z += delta * 7;
    } else {
      ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, 0, 6, delta);
      ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, 0, 6, delta);
    }
  });

  return (
    <group position={[0, 1.5, 0]}>
      <mesh ref={ref} castShadow>
        <boxGeometry args={[1.15, 1.15, 1.15]} />
        <meshStandardMaterial color="#fbf8f3" roughness={0.28} metalness={0.12} />
      </mesh>
      <Text position={[0, 0, 0.59]} fontSize={0.45} color="#292724" anchorX="center" anchorY="middle">
        {value ?? '·'}
      </Text>
    </group>
  );
}

function Base({ seat, color }: { seat: number; color: string }) {
  const positions = [[-3.5, -3.5], [3.5, -3.5], [3.5, 3.5], [-3.5, 3.5]];
  const [x, z] = positions[seat];
  return (
    <mesh position={[x, 0.22, z]} receiveShadow>
      <boxGeometry args={[4.2, 0.38, 4.2]} />
      <meshStandardMaterial color={palette[color]} roughness={0.55} />
    </mesh>
  );
}

export function Board3D({
  players,
  tokens,
  currentPlayer,
  localSeat,
  dice,
  legalTokens,
  rolling = false,
  onTokenClick,
}: BoardProps) {
  const path = useMemo(() => Array.from({ length: 52 }, (_, index) => index), []);

  return (
    <group rotation={[-0.05, 0, 0]}>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[15.6, 0.5, 15.6]} />
        <meshStandardMaterial color="#3a342e" roughness={0.8} />
      </mesh>
      {players.map((player, seat) => (
        <Base key={player.color} seat={seat} color={player.color} />
      ))}
      {path.map((index) => {
        const [x, z] = pathCell(index);
        const isSafe = safe.has(index);
        const owner = offsets.indexOf(index);
        return (
          <mesh key={index} position={[x, 0.25, z]} receiveShadow>
            <boxGeometry args={[0.86, 0.18, 0.86]} />
            <meshStandardMaterial
              color={isSafe ? '#fff7da' : owner >= 0 ? palette[players[owner]?.color || 'red'] : '#efe8dc'}
              roughness={0.45}
            />
          </mesh>
        );
      })}
      {players.map((player, seat) =>
        Array.from({ length: 6 }, (_, lane) => {
          const [sx, sz] = pathCell(offsets[seat]);
          const t = (lane + 1) / 7;
          return (
            <mesh key={`${player.color}-home-${lane}`} position={[sx * (1 - t), 0.27, sz * (1 - t)]}>
              <boxGeometry args={[0.76, 0.14, 0.76]} />
              <meshStandardMaterial color={palette[player.color]} roughness={0.45} />
            </mesh>
          );
        })
      )}
      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[2.8, 2.8]} />
        <meshStandardMaterial color="#fff7da" />
      </mesh>
      {tokens.map((playerTokens, seat) =>
        playerTokens.map((token, index) => (
          <Token
            key={`${seat}-${index}`}
            token={token}
            seat={seat}
            index={index}
            selected={seat === currentPlayer && legalTokens.includes(index)}
            clickable={seat === localSeat && seat === currentPlayer && legalTokens.includes(index)}
            onClick={() => onTokenClick(index)}
          />
        ))
      )}
      <Dice value={dice} rolling={rolling} />
    </group>
  );
}
