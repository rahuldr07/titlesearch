import { useState } from "react";
import type { Key } from "react-aria-components";
import { Option, Select } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { jurisdiction } from "../../shared/jurisdictionQueries";
import { QueryState } from "../../entities/state/QueryState";
import {
  DEFAULT_JURISDICTION_CODE,
  isJurisdictionCode,
  JURISDICTION_CODES,
} from "./jurisdictionCodes";
import { RuleList } from "./RuleList";
import { NullStateMatrix } from "./NullStateMatrix";

/**
 * THE JURISDICTION VIEW — what binds here, and how absence is written out.
 *
 * The picker is the design's jurisdiction simulator: it changes the code in the
 * read, and everything on the page is then the server's answer for that code.
 * Nothing is re-derived from the previous one.
 */
export function JurisdictionScreen() {
  const [code, setCode] = useState<string>(DEFAULT_JURISDICTION_CODE);
  const read = useRead(jurisdiction(code));

  return (
    <div
      data-testid="jurisdiction-screen"
      className="tp-screen-enter flex h-full min-h-0 flex-col overflow-y-auto px-20 py-16"
    >
      <div className="flex w-full max-w-500 flex-col gap-12">
        <header className="flex flex-wrap items-end justify-between gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-title font-semibold leading-tight text-ink-primary">
              Jurisdiction
            </h1>
            <p className="text-meta leading-body text-ink-muted">
              The overrides in force here, and the sentence each kind of absence is
              written out as.
            </p>
          </div>
          <div className="flex w-160 flex-col gap-3">
            <span className="text-label leading-flat font-semibold text-ink-secondary">
              Active jurisdiction
            </span>
            <Select
              label="Active jurisdiction"
              selectedKey={code}
              onSelectionChange={(key: Key | null) => {
                const next = key === null ? "" : String(key);
                if (isJurisdictionCode(next)) setCode(next);
              }}
            >
              {JURISDICTION_CODES.map((entry) => (
                <Option key={entry.code} id={entry.code}>
                  {entry.name}
                </Option>
              ))}
            </Select>
          </div>
        </header>

        <QueryState query={read} of="this jurisdiction">
          {(data) => (
            <div className="flex flex-col gap-14">
              <div className="flex flex-wrap items-baseline gap-6">
                <span className="text-subject font-semibold leading-tight text-ink-primary">
                  {data.label}
                </span>
                {/* Rule 3: the code is the identifier the read was made with. */}
                <span className="font-mono text-meta leading-close text-ink-muted">
                  {data.code}
                </span>
                <span className="text-meta leading-body text-ink-secondary">
                  {data.baseline_note}
                </span>
              </div>

              <section className="flex flex-col gap-6">
                <h2 className="text-body font-semibold leading-tight text-ink-primary">
                  Rules
                </h2>
                <p className="text-meta leading-body text-ink-muted">
                  Whether a rule binds is the server’s answer, carried on the rule.
                </p>
                <RuleList rules={data.rules} label={data.label} />
              </section>

              <section className="flex flex-col gap-6">
                <h2 className="text-body font-semibold leading-tight text-ink-primary">
                  Null state matrix
                </h2>
                <p className="text-meta leading-body text-ink-muted">
                  Four different facts, never one. Each declares the string it is
                  written out as here.
                </p>
                <NullStateMatrix rows={data.null_states} />
              </section>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
