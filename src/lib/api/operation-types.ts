import type { components, operations } from "@/types/openapi";

/**
 * Type helpers that pull request/response shapes out of the generated OpenAPI types by
 * `operationId`. Services below name an operation once and derive every other type from it, so a
 * backend change only has to be reflected by re-running `npm run api:types`.
 */

type JsonContent<T> = T extends { content: { "application/json": infer Content } } ? Content : void;

export type SuccessResponse<Operation extends keyof operations> =
  200 extends keyof operations[Operation]["responses"]
    ? JsonContent<operations[Operation]["responses"][200]>
    : 201 extends keyof operations[Operation]["responses"]
      ? JsonContent<operations[Operation]["responses"][201]>
      : 202 extends keyof operations[Operation]["responses"]
        ? JsonContent<operations[Operation]["responses"][202]>
        : 204 extends keyof operations[Operation]["responses"]
          ? void
          : never;

export type QueryParams<Operation extends keyof operations> =
  operations[Operation]["parameters"] extends { query?: infer Query } ? NonNullable<Query> : never;

export type PathParams<Operation extends keyof operations> =
  operations[Operation]["parameters"] extends { path?: infer Path } ? NonNullable<Path> : never;

export type HeaderParams<Operation extends keyof operations> =
  operations[Operation]["parameters"] extends { header?: infer Header } ? NonNullable<Header> : never;

export type RequestBody<Operation extends keyof operations> =
  operations[Operation] extends { requestBody?: { content: { "application/json": infer Body } } }
    ? Body
    : never;

/** A paged response, e.g. `AdminOrderPageResponse`. */
export type PageOf<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Schemas = components["schemas"];
