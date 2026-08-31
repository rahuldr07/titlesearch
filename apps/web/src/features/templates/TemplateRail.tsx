import { useState } from "react";
import type { Key } from "react-aria-components";
import type { TemplateCatalogResponse, TemplateSampleDoc } from "@titlepipe/contract";
import { Input, Option, Select, cx } from "../../components/ui";
import { SampleInspector } from "./SampleInspector";

/**
 * The catalog rail — search, the two served filter vocabularies, one card
 * per template, and the scoped client samples beneath. Search and filters
 * narrow the served list in the browser — presentation of one response, not
 * a browse endpoint. Every card fact is the server's member printed.
 */
export function TemplateRail({
  catalog,
  activeId,
  onPick,
  samples,
  activeClient,
}: {
  readonly catalog: TemplateCatalogResponse;
  readonly activeId: string | null;
  readonly onPick: (id: string) => void;
  readonly samples: readonly TemplateSampleDoc[];
  readonly activeClient: string | null;
}) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("All");
  const [product, setProduct] = useState("All");

  const q = query.trim().toLowerCase();
  const filtered = catalog.templates.filter(
    (t) =>
      (client === "All" || t.client === client) &&
      (product === "All" || t.product === product) &&
      (q === "" ||
        `${t.name} ${t.client} ${t.product}`.toLowerCase().includes(q)),
  );

  return (
    <div className="flex w-140 shrink-0 flex-col overflow-hidden border-r border-line-strong bg-surface-panel">
      <div className="flex flex-col gap-5 border-b border-line-subtle p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-label leading-flat font-bold text-ink-muted">
            Templates Architect
          </span>
          <span className="rounded-lg bg-surface-sunken px-4 py-1 font-mono text-label leading-flat font-semibold text-ink-secondary">
            {`${String(filtered.length)} of ${String(catalog.templates.length)}`}
          </span>
        </div>
        <Input
          aria-label="Search templates or clients"
          placeholder="Search templates or clients…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Client"
            selectedKey={client}
            onSelectionChange={(key: Key | null) => setClient(key === null ? "All" : String(key))}
          >
            {["All", ...catalog.clients].map((name) => (
              <Option key={name} id={name}>
                {name === "All" ? "All clients" : name}
              </Option>
            ))}
          </Select>
          <Select
            label="Product"
            selectedKey={product}
            onSelectionChange={(key: Key | null) => setProduct(key === null ? "All" : String(key))}
          >
            {["All", ...catalog.products].map((name) => (
              <Option key={name} id={name}>
                {name === "All" ? "All products" : name}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`template-${t.id}`}
            aria-current={t.id === activeId}
            onClick={() => onPick(t.id)}
            className={cx(
              "tp-state flex cursor-pointer flex-col gap-3 rounded-lg border p-6 text-left",
              t.id === activeId
                ? "border-action bg-action-surface"
                : "border-line-strong bg-surface-panel hover:bg-surface-sunken",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-sans text-meta leading-close font-bold text-ink-primary">
                {t.name}
              </span>
              <span
                className={cx(
                  "shrink-0 rounded-lg border px-3 py-1 font-sans text-label leading-flat font-bold",
                  t.status === "active"
                    ? "border-state-settled-border bg-state-settled-surface text-state-settled"
                    : "border-state-attend-border bg-state-attend-surface text-state-attend",
                )}
              >
                {t.status}
              </span>
            </span>
            <span className="font-sans text-label leading-flat text-ink-muted">
              {t.client}
              <span aria-hidden className="px-2 text-ink-faint">
                ·
              </span>
              <span className="font-semibold text-ink-secondary">{t.product}</span>
            </span>
            <span className="flex items-baseline justify-between border-t border-line-subtle pt-3 font-mono text-label leading-flat text-ink-muted">
              <span className="text-state-settled">{`✓ ${String(t.mapped_fields)}/${String(t.total_fields)}`}</span>
              <span className="font-semibold text-ink-primary">{t.version}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-4 border-t border-line-subtle bg-surface-sunken p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-label leading-flat font-bold text-ink-muted">
            Scoped client samples
          </span>
          {activeClient !== null && (
            <span className="rounded-lg bg-action-surface px-3 py-1 font-sans text-label leading-flat font-bold text-ink-secondary">
              {activeClient}
            </span>
          )}
        </div>
        <div className="flex max-h-70 flex-col gap-3 overflow-y-auto">
          {samples.map((sample) => (
            <SampleInspector key={sample.id} sample={sample} client={activeClient} />
          ))}
        </div>
      </div>
    </div>
  );
}
