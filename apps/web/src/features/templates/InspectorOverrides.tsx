import { useState } from "react";
import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { jurisdiction } from "../../shared/jurisdictionQueries";
import { QueryState } from "../../entities/state/QueryState";

/**
 * The jurisdiction simulator — the inspector's Overrides tab. The picker
 * changes the code in the same read the Jurisdiction screen makes;
 * everything shown is the server's answer for that code, never a
 * re-derivation. The option list restates the order book's five codes — it
 * cannot import `features/jurisdiction`'s list (cross-feature imports are
 * banned), so the restated list is accepted and said out loud here.
 */
const OPTIONS = [
  { code: "clayton-ga", name: "Clayton, GA (Live overlay)" },
  { code: "greene-ga", name: "Greene, GA" },
  { code: "houston-ga", name: "Houston, GA" },
  { code: "greene-ny", name: "Greene, NY" },
  { code: "mecklenburg-nc", name: "Mecklenburg, NC" },
] as const;

export function InspectorOverrides() {
  const [code, setCode] = useState<string>(OPTIONS[0].code);
  const read = useRead(jurisdiction(code));

  return (
    <div className="flex flex-col gap-6" data-testid="jurisdiction-simulator">
      <div className="border-b border-line-subtle pb-4">
        <span className="block font-sans text-meta leading-close font-bold text-ink-primary">
          Jurisdiction simulator
        </span>
        <span className="block pt-1 font-sans text-label leading-close text-ink-muted">
          Preview how state-specific regulatory overrides modify standard block
          outputs.
        </span>
      </div>

      <Select
        label="Active jurisdiction"
        selectedKey={code}
        onSelectionChange={(key: Key | null) => {
          const next = key === null ? "" : String(key);
          if (OPTIONS.some((option) => option.code === next)) setCode(next);
        }}
      >
        {OPTIONS.map((option) => (
          <Option key={option.code} id={option.code}>
            {option.name}
          </Option>
        ))}
      </Select>

      <QueryState query={read} of="this jurisdiction">
        {(data) => (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-line-strong bg-surface-sunken p-6">
              <span className="block pb-1 font-sans text-label leading-flat font-bold text-ink-secondary">
                {data.label}
              </span>
              <span className="font-sans text-label leading-body text-ink-secondary">
                {data.baseline_note}
              </span>
            </div>
            {data.rules
              .filter((rule) => rule.applies)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-md border border-line-subtle bg-surface-panel p-5"
                >
                  <span className="block pb-1 font-mono text-label leading-flat font-semibold text-ink-secondary">
                    {rule.code}
                  </span>
                  <span className="font-sans text-label leading-body text-ink-primary">
                    {rule.text}
                  </span>
                </div>
              ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
