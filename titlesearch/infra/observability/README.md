# Observability — the contract, before the collectors

No collector, exporter or dashboard is deployed at Gate 1. What exists is the
contract every service already implements, written down here so the exporters
that arrive at Gate 10 are configured to match rather than inventing their own
rules.

There is one reason to write this now: **auto-instrumentation is the largest
silent NPI risk in the system.** OpenTelemetry's HTTP and database
instrumentation captures URLs, query strings and SQL statement values by
default. Turning it on without an allowlist would export grantor names and
legal descriptions to a collector on the day it is enabled, and the leak would
be invisible in code review because nobody wrote a line that logs them.

## The three pipelines redact independently

Defence in depth means each pipeline is safe on its own, because each has a
different failure mode and they are configured by different people.

| Pipeline | Mechanism | Status at Gate 1 |
|---|---|---|
| Logs | `redaction_processor` first in the structlog chain | **Implemented and tested** in all four services |
| Traces | Attribute allowlist + collector-side scrubbing | Contract defined below; no exporter yet |
| Metrics | Bounded label sets; no identifiers in labels | `RequestMetrics` seam exists; no backend yet |
| Errors | Sentry `send_default_pii=False` + `before_send` | Optional, deferred pending telemetry review |

## What must never leave a process

Document text · source snippets · party names of any role · addresses, parcels
and legal descriptions · dates of birth · bankruptcy details · model prompts and
completions · presigned URLs · connection strings · session cookies and seal
passwords · request and response bodies · SQL bind values · query strings.

## What must always be present

Without these an incident is not diagnosable, so redaction that removes them
gets switched off by whoever is on call — which is how the rest stops being
enforced.

Request/correlation ID · event name · level · timestamp (UTC) · service name ·
duration · status code · error code · counts.

## Metric labels

Prometheus label values are unbounded cardinality *and* an exfiltration
channel. Permitted: service, environment, method, templated route, status
class, job name, outcome. Forbidden: tenant ID, order ID, user ID, package
hash, file name, any free-form string.

`RequestMetrics.record_request` takes a fixed argument list and no attribute
bag for exactly this reason — there is nowhere to put an identifier.

## Trace attributes

Allowlist, never denylist: a denylist fails open on every attribute someone
adds later. Instrument with `URLFilter`/span processors that drop query strings
outright, disable SQL statement capture rather than trying to sanitise it, and
scrub again at the collector so an application-side mistake is caught by
infrastructure.

## Product audit is not telemetry

`audit_events` is an append-only business record: server-derived actor, tenant,
action code, entity type and opaque ID, timestamp, reason, safe before/after
metadata. It is queried by administrators, retained under the tenant retention
policy, and is evidence.

Technical telemetry is operational, sampled and short-lived. The two are
separate stores with separate retention and separate access control, and
neither substitutes for the other.

## Queue and worker metrics stay internal

Queue depth, lease age and worker health are operations metrics. They are never
surfaced as product dashboards, and per-reviewer throughput does not exist as
data anywhere in this system — see the anti-patterns in `docs/CONTEXT.md` §14.
