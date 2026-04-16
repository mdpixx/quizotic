import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#18181b",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 80,
          fontWeight: 700,
          opacity,
          fontFamily: "sans-serif",
        }}
      >
        Hello Remotion!
      </div>
    </AbsoluteFill>
  );
};
