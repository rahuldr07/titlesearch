import { Card } from "../../components/ui";

/**

 * One block of grants. Both halves of `/api/me/permissions` render the same way — a

 * door is a grant that carries a `path` and an action is one that does not, which is

 * the only structural difference between them in the payload.

 */
export function GrantList(props: {
  readonly heading: string;
  readonly note: string;
  readonly items: readonly {
    key: string;
    name: string;
    detail: string | null;
  }[];
}) {
  return (
    <Card padding="none">
      <div className="flex flex-col gap-2 border-b border-line-subtle bg-surface-sunken px-12 py-6">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          {props.heading}
        </span>
        <span className="text-label leading-close text-ink-muted">{props.note}</span>
      </div>
      <ul>
        {props.items.map((item) => (
          <li
            key={item.key}
            className="flex items-baseline justify-between gap-8 border-b border-line-subtle px-12 py-5 last:border-b-0"
          >
            <span className="font-mono text-meta leading-close text-ink-primary">
              {item.name}
            </span>
            {item.detail !== null && (
              <span className="font-mono text-label leading-flat text-ink-muted">
                {item.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
