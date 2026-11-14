import type { AuthController } from '../controllers/auth.controller.js';
import type { ProfileController } from '../controllers/profile.controller.js';
import type { AnyRouteSpec } from '../utils/http.js';
import { authRoutes } from './auth.routes.js';
import { profileRoutes } from './profile.routes.js';

export interface Controllers {
  auth: AuthController;
  profiles: ProfileController;
}

/**
 * Every versioned endpoint. This table drives the router and the OpenAPI document.
 */
export function buildRoutes(controllers: Controllers): AnyRouteSpec[] {
  return [...authRoutes(controllers.auth), ...profileRoutes(controllers.profiles)];
}
