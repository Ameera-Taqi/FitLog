import Svg, { Path, Circle } from "react-native-svg";

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

function svgProps(size: number, color: string, sw: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function DumbbellIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
    </Svg>
  );
}

export function FlameIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function ChartIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
    </Svg>
  );
}

export function TrophyIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}

export function HomeIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = "#fff", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function TargetIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1" />
    </Svg>
  );
}

export function ClockIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function TimerIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M10 2h4M12 14l3-3" />
      <Circle cx="12" cy="14" r="8" />
    </Svg>
  );
}

export function BagIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M3 9h18l-1.4 9.3a2 2 0 0 1-2 1.7H6.4a2 2 0 0 1-2-1.7L3 9zM8 9V6a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function UserIcon({ size = 22, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...svgProps(size, color, strokeWidth)}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}
