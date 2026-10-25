import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { SuccessResponse } from "@/lib/api/operation-types";

type HealthOp = "health_check_api_v1_health_get";
type DatabaseHealthOp = "database_health_check_api_v1_health_database_get";

export type Health = SuccessResponse<HealthOp>;
export type DatabaseHealth = SuccessResponse<DatabaseHealthOp>;
export type DatabasePool = DatabaseHealth["pool"];

export const healthPaths = {
  health: "health",
  database: "health/database",
} as const;

export const healthKeys = {
  all: ["system", "health"] as const,
  health: () => [...healthKeys.all, "service"] as const,
  database: () => [...healthKeys.all, "database"] as const,
};

export function getHealth(): Promise<Health> {
  return apiGet(healthPaths.health);
}

export function getDatabaseHealth(): Promise<DatabaseHealth> {
  return apiGet(healthPaths.database);
}

export const healthQueries = {
  health: () => queryOptions({ queryKey: healthKeys.health(), queryFn: getHealth, staleTime: 15_000 }),
  database: () => queryOptions({ queryKey: healthKeys.database(), queryFn: getDatabaseHealth, staleTime: 15_000 }),
};
