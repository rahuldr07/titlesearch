import raw from "./realPackage.json";

/**
 * The real county package, as a typed fixture.
 *
 * `realPackage.json` ships EMPTY and is meant to stay that way in VCS: this
 * is a public repository, and a county search package names real people,
 * their addresses, and judgments entered against them. Populate it locally —
 *
 *   node packages/mocks/scripts/build-real-package.mjs <ocr-run-dir> \
 *        packages/mocks/src/realPackage.json
 *
 * — and leave the result uncommitted. With the file empty, `ord_real_1`
 * simply has no pages, fields or composition, which every screen already
 * renders as "the server holds nothing for this order".
 *
 * The cast is what lets both states compile: an empty `[]` in JSON infers as
 * `never[]`, so the shape has to be declared rather than inferred.
 */
export type RealPackageField = {
  readonly id: string;
  readonly path: string;
  readonly value: string;
  readonly section: string;
  readonly source_doc_id: string;
  readonly source_page: number;
  readonly source_snippet: string;
  readonly source_line_coords: {
    readonly page: number;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly engine_id: string;
};

export type RealPackage = {
  readonly source: string;
  readonly total: number;
  readonly pages: {
    n: number;
    read_in_full: boolean;
    kind: string;
    readonly lines: string[];
    degraded: boolean;
    image_url: string;
  }[];
  readonly instruments: {
    id: string;
    kind: string;
    label: string;
    first_page: number;
    last_page: number;
    recorded_ref: string | null;
  }[];
  readonly fields: readonly RealPackageField[];
  readonly composition: {
    readonly blocks: readonly {
      id: string;
      readonly numeral: string;
      readonly title: string;
      readonly values: readonly {
        label: string;
        readonly value: string;
        readonly pending: boolean;
        readonly field_id: string | null;
      }[];
      readonly field_count: number;
      readonly cited: number;
    }[];
  };
};

export const realPackage = raw as unknown as RealPackage;
