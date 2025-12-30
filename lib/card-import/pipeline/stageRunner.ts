type StageHandler<T> = () => Promise<T> | T;

type StageMetrics = {
  stage: string;
  durationMs: number;
  extra?: Record<string, unknown>;
};

function logStageFinish({ stage, durationMs, extra }: StageMetrics) {
  const payload = { stage, durationMs: Number(durationMs.toFixed(2)), ...(extra ?? {}) };
  console.info("[card-import] stage completed", payload);
}

function logStageError(stage: string, durationMs: number, error: unknown) {
  console.error("[card-import] stage failed", {
    stage,
    durationMs: Number(durationMs.toFixed(2)),
    error,
  });
}

export async function runStage<T>(
  stage: string,
  handler: StageHandler<T>,
  extraMetrics?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await handler();
    logStageFinish({ stage, durationMs: Date.now() - start, extra: extraMetrics?.(result) });
    return result;
  } catch (error) {
    logStageError(stage, Date.now() - start, error);
    throw error;
  }
}
