import type { AnyRouteSpec } from '../utils/http.js';

/**
 * Every versioned endpoint. This table drives the router and the OpenAPI document.
 * Handlers are attached by the composition root; see `buildRoutes` in later modules.
 */
export const ROUTE_TABLE: AnyRouteSpec[] = [];
