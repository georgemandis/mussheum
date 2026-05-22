import { Box, Text } from "ink";
import BigText from "ink-big-text";
import { useState, useEffect, type ReactNode } from "react";
import type { GalleryConfig } from "../lib/gallery.js";
import { useTerminalSize } from "../lib/useTerminalSize.js";

type Props = {
  error?: string | null;
  children?: ReactNode;
  config: GalleryConfig | null;
};

export function Splash({ error, children, config }: Props) {
  const { rows, cols } = useTerminalSize();
  const [showCursor, setShowCursor] = useState(true);
  const accent = config?.accentColor ?? "cyan";
  const name = config?.name ?? "mussheum";
  const tagline = config?.tagline ?? "an ssh art gallery";

  useEffect(() => {
    const blink = setInterval(() => {
      setShowCursor((v) => !v);
    }, 530);

    return () => clearInterval(blink);
  }, []);

  const cursor = showCursor ? "\u2588" : " ";

  return (
    <Box
      flexDirection="column"
      height={rows}
      width={cols}
      alignItems="center"
      justifyContent="center"
    >
      <BigText text={name} font="tiny" colors={[accent]} />
      <Text dimColor>{tagline}</Text>
      {config?.exhibition && (
        <Text dimColor italic>{config.exhibition}</Text>
      )}
      <Text> </Text>
      <Text>
        <Text color={accent}>{cursor}</Text>
      </Text>
      {error && (
        <>
          <Text> </Text>
          <Text color="red">{error}</Text>
        </>
      )}
      {children}
    </Box>
  );
}
