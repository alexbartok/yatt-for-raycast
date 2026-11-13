import { Action, ActionPanel, Detail } from "@raycast/api";
import { useMemo } from "react";
import type { ZoneInfo } from "./core/dataset";
import { dayShift, formatDate, formatDayShift, formatWindow, type TimeFormat } from "./core/format";
import { formatOffset, zoneAbbreviation, zoneOffset } from "./core/time";

type Props = {
  start: number;
  end?: number;
  anchorTz: string;
  anchorLabel: string;
  fmt: TimeFormat;
  zones: ZoneInfo[];
};

/** Every canonical zone at one instant, sorted west to east. */
export function AllZones({ start, end, anchorTz, anchorLabel, fmt, zones }: Props) {
  const markdown = useMemo(() => {
    const anchorOffset = zoneOffset(start, anchorTz);
    const rows = zones
      .filter((z) => z.canonical === z.name)
      .map((z) => ({ zone: z, offset: zoneOffset(start, z.name) }))
      .sort((a, b) => a.offset - b.offset || a.zone.name.localeCompare(b.zone.name))
      .map(({ zone, offset }) => {
        const label = zone.name === "UTC" ? "UTC" : (zone.name.split("/").pop() ?? zone.name).replace(/_/g, " ");
        const shift = formatDayShift(dayShift(start, zone.name, anchorTz));
        const time = `${formatWindow(start, end, zone.name, fmt)}${shift ? ` (${shift})` : ""}`;
        return `| ${label} | ${time} | ${zoneAbbreviation(start, zone.name, zone.abbr)} | ${formatOffset(offset, "UTC")} | ${formatOffset(offset - anchorOffset)} |`;
      });

    return [
      `# ${formatWindow(start, end, anchorTz, fmt)} — ${anchorLabel}`,
      "",
      formatDate(start, anchorTz),
      "",
      "| Zone | Time | Abbrev. | Offset | vs. anchor |",
      "| --- | --- | --- | --- | --- |",
      ...rows,
    ].join("\n");
  }, [start, end, anchorTz, anchorLabel, fmt, zones]);

  return (
    <Detail
      navigationTitle="All Zones"
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Table" content={markdown} />
        </ActionPanel>
      }
    />
  );
}
