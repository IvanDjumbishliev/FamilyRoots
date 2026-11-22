import Svg, { Circle, Path, Rect } from 'react-native-svg';

const nodes = [
  [180, 57],
  [102, 156],
  [258, 156],
];

export function FamilyIllustration() {
  return (
    <Svg
      viewBox="0 0 360 224"
      width="100%"
      height="100%"
      aria-hidden
      accessible={false}
    >
      <Circle cx="180" cy="109" r="106" fill="#224B3E" />
      <Circle
        cx="180"
        cy="109"
        r="105"
        stroke="#C4A46B"
        opacity=".25"
        fill="none"
      />
      <Path
        d="M180 89v27m-78 13v-13h156v13"
        fill="none"
        stroke="#C4A46B"
        strokeWidth="1.5"
      />
      <Path
        d="M68 62c-19-2-27-13-25-31 19 4 26 13 25 31Zm-8 20c-19 3-31-2-36-17 17-5 29 1 36 17Zm235 12c7-18 20-23 37-19-6 17-18 22-37 19Zm-1-19c-4-18 3-29 20-35 4 17-3 29-20 35Z"
        stroke="#C4A46B"
        fill="none"
        opacity=".52"
      />
      {nodes.map(([x, y]) => (
        <Rect
          key={x}
          x={x - 42}
          y={y - 27}
          width="84"
          height="56"
          rx="13"
          fill="#2C5547"
          stroke="#B99A66"
          strokeWidth="1.2"
        />
      ))}
      {nodes.map(([x, y]) => (
        <Path
          key={x}
          d={`M${x - 2} ${y - 2}a7 7 0 1 0-14 0 7 7 0 1 0 14 0m-17 15c2-7 14-7 17 0m8-16h13m-13 8h9`}
          stroke="#E4CA95"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <Path
        d="M55 153v14m-7-7h14m246-30v15m-7-7h14M142 191v13m-6-6h12"
        stroke="#C4A46B"
        strokeWidth="1.3"
        opacity=".7"
      />
    </Svg>
  );
}
