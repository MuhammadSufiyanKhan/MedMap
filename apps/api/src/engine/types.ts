import type {
  CheckedMedication,
  FlaggedPair,
  MedicationKind,
  SeveritySummary,
  UncheckedMedication,
} from '@medmap/shared';
import type { InteractionDatasetEntity, InteractionPairEntity } from '../types/entities.js';

/** The part of a medicine the engine needs. */
export interface EngineMedication {
  id: string;
  displayName: string;
  strengthText: string | null;
  kind: MedicationKind;
  ingredientRxcuis: string[];
}

/** An unordered ingredient pair with `a` sorting before `b`. */
export interface IngredientPairKey {
  a: string;
  b: string;
}

/**
 * Where interaction data comes from. The bundled implementation reads the imported
 * dataset from MongoDB; a licensed provider can be swapped in by implementing this
 * interface.
 *
 * Implementations must answer `findPairs` by indexed lookup of exactly the requested
 * pairs, never by scanning the dataset.
 */
export interface InteractionSource {
  /** The dataset currently in use, or null when none has been imported. */
  getActiveDataset(): Promise<InteractionDatasetEntity | null>;
  /** The subset of `pairs` the dataset flags. */
  findPairs(datasetId: string, pairs: IngredientPairKey[]): Promise<InteractionPairEntity[]>;
  /** The subset of `ingredients` that appear anywhere in the dataset. */
  knownIngredients(datasetId: string, ingredients: string[]): Promise<Set<string>>;
}

export interface EngineResult {
  medications: CheckedMedication[];
  flaggedPairs: FlaggedPair[];
  uncheckedMedications: UncheckedMedication[];
  checkedPairCount: number;
  summary: SeveritySummary;
}
