/**
 * Training configuration (hyper-parameters are documented in the README).
 */
export interface LinearConfig {
  /** L2 penalty – tiny, only to keep the normal equations well conditioned with one-hot features. */
  lambda: number;
}

export interface ForestConfig {
  nEstimators: number;
  maxDepth: number;
  minSamplesLeaf: number;
  /** Fraction of features evaluated at every split. */
  maxFeatures: number;
}

export interface BoostingConfig {
  nEstimators: number;
  learningRate: number;
  maxDepth: number;
  minSamplesLeaf: number;
  /** Row subsampling per tree (stochastic gradient boosting). */
  subsample: number;
  maxFeatures: number;
  /** L2 regularisation on leaf values. */
  lambda: number;
}

export interface TrainingConfig {
  seed: number;
  /** Market snapshot year: vehicle age = referenceYear - model year. */
  referenceYear: number;
  testSize: number;
  cvFolds: number;
  /** Max histogram bins per feature for the tree learners (≤ 255). */
  maxBins: number;
  permutationRepeats: number;
  linear: LinearConfig;
  forest: ForestConfig;
  boosting: BoostingConfig;
}

export const REFERENCE_YEAR = 2026;

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  seed: 42,
  referenceYear: REFERENCE_YEAR,
  testSize: 0.2,
  cvFolds: 5,
  maxBins: 255,
  permutationRepeats: 2,
  linear: { lambda: 1 },
  forest: { nEstimators: 50, maxDepth: 12, minSamplesLeaf: 5, maxFeatures: 0.7 },
  boosting: {
    nEstimators: 500,
    learningRate: 0.05,
    maxDepth: 6,
    minSamplesLeaf: 10,
    subsample: 0.8,
    maxFeatures: 0.9,
    lambda: 1,
  },
};

/** Small configuration used by the automated tests (seconds instead of minutes). */
export const FAST_TRAINING_CONFIG: TrainingConfig = {
  ...DEFAULT_TRAINING_CONFIG,
  cvFolds: 2,
  permutationRepeats: 1,
  forest: { nEstimators: 12, maxDepth: 10, minSamplesLeaf: 3, maxFeatures: 0.6 },
  boosting: { ...DEFAULT_TRAINING_CONFIG.boosting, nEstimators: 150, learningRate: 0.1, maxDepth: 5 },
};
