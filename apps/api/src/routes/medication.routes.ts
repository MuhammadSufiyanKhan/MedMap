import {
  appConfigSchema,
  createMedicationRequestSchema,
  interactionCheckSchema,
  medicationListQuerySchema,
  medicationPageSchema,
  medicationParamsSchema,
  medicationSchema,
  normalizeQuerySchema,
  normalizeResponseSchema,
  profileParamsSchema,
  updateMedicationRequestSchema,
} from '@medmap/shared';
import type { InteractionController } from '../controllers/interaction.controller.js';
import type { MedicationController } from '../controllers/medication.controller.js';
import { defineRoute } from '../utils/http.js';
import type { AnyRouteSpec } from '../utils/http.js';

export function medicationRoutes(controller: MedicationController): AnyRouteSpec[] {
  const tag = 'Medicines';
  return [
    defineRoute({
      method: 'get',
      path: '/profiles/:profileId/medications',
      summary: 'List medicines on a profile',
      tag,
      params: profileParamsSchema,
      query: medicationListQuerySchema,
      responses: { 200: { description: 'A page of medicines', schema: medicationPageSchema } },
      handler: controller.list,
    }),
    defineRoute({
      method: 'post',
      path: '/profiles/:profileId/medications',
      summary: 'Add a medicine (caregiver or owner)',
      tag,
      idempotent: true,
      params: profileParamsSchema,
      body: createMedicationRequestSchema,
      responses: { 201: { description: 'Medicine added', schema: medicationSchema } },
      handler: controller.create,
    }),
    defineRoute({
      method: 'get',
      path: '/profiles/:profileId/medications/:medicationId',
      summary: 'Get a medicine',
      tag,
      params: medicationParamsSchema,
      responses: { 200: { description: 'The medicine', schema: medicationSchema } },
      handler: controller.get,
    }),
    defineRoute({
      method: 'patch',
      path: '/profiles/:profileId/medications/:medicationId',
      summary: 'Change a medicine (caregiver or owner)',
      tag,
      ifMatch: true,
      params: medicationParamsSchema,
      body: updateMedicationRequestSchema,
      responses: { 200: { description: 'Updated medicine', schema: medicationSchema } },
      handler: controller.update,
    }),
    defineRoute({
      method: 'delete',
      path: '/profiles/:profileId/medications/:medicationId',
      summary: 'Remove a medicine (caregiver or owner)',
      tag,
      params: medicationParamsSchema,
      responses: { 204: { description: 'Removed' } },
      handler: controller.remove,
    }),
    defineRoute({
      method: 'get',
      path: '/drugs/normalize',
      summary: 'Match a typed name to known medicines',
      tag,
      query: normalizeQuerySchema,
      responses: { 200: { description: 'Candidate matches', schema: normalizeResponseSchema } },
      handler: controller.normalize,
    }),
  ];
}

export function interactionRoutes(controller: InteractionController): AnyRouteSpec[] {
  const tag = 'Interaction checks';
  return [
    defineRoute({
      method: 'post',
      path: '/profiles/:profileId/interaction-checks',
      summary: "Check every pair of the profile's active medicines",
      tag,
      params: profileParamsSchema,
      responses: { 201: { description: 'The new check', schema: interactionCheckSchema } },
      handler: controller.run,
    }),
    defineRoute({
      method: 'get',
      path: '/profiles/:profileId/interaction-checks/latest',
      summary: 'The most recent check for a profile',
      tag,
      params: profileParamsSchema,
      responses: { 200: { description: 'The latest check', schema: interactionCheckSchema } },
      handler: controller.latest,
    }),
    defineRoute({
      method: 'get',
      path: '/app-config',
      summary: 'Public configuration: active dataset, demo mode, label extraction',
      tag: 'Meta',
      auth: 'public',
      responses: { 200: { description: 'Configuration', schema: appConfigSchema } },
      handler: controller.appConfig,
    }),
  ];
}
