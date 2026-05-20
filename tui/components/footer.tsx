import { Box, Text, useStdout } from "ink";
import type { GalleryConfig } from "../lib/gallery.js";

type Props = {
  screen: string;
  config: GalleryConfig | null;
  prevTitle?: string | null;
  nextTitle?: string | null;
  hasArchive?: boolean;
};

const hints: Record<string, string[]> = {
  list: ["↑/↓ navigate", "enter view", "q quit"],
  detail: ["b/esc back"],
};

export function Footer({ screen, config, prevTitle, nextTitle, hasArchive }: Props) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const items = [...(hints[screen] ?? [])];
  if (screen === "list" && hasArchive) items.push("a archive");
  if (screen === "list") items.push("s subscribe");
  const name = config?.name ?? "mussheum";

  return (
    <Box width={cols} justifyContent="space-between">
      <Text color="gray"> {name}{config?.exhibition ? <Text dimColor italic> · {config.exhibition}</Text> : null}</Text>
      <Box gap={2}>
        {screen === "detail" && prevTitle && (
          <Text dimColor>← {prevTitle}</Text>
        )}
        {items.map((hint) => (
          <Text key={hint} dimColor>
            {hint}
          </Text>
        ))}
        {screen === "detail" && nextTitle && (
          <Text dimColor>{nextTitle} →</Text>
        )}
      </Box>
      <Text color="gray"> </Text>
    </Box>
  );
}
