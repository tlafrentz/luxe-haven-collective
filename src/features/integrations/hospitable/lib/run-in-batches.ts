export async function runInBatches<TInput, TResult>({
  items,
  batchSize,
  handler,
}: {
  items: TInput[];
  batchSize: number;
  handler: (
    item: TInput,
    index: number,
  ) => Promise<TResult>;
}): Promise<TResult[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      "Batch size must be a positive integer.",
    );
  }

  const results: TResult[] = [];

  for (
    let startIndex = 0;
    startIndex < items.length;
    startIndex += batchSize
  ) {
    const batch = items.slice(
      startIndex,
      startIndex + batchSize,
    );

    const batchResults = await Promise.all(
      batch.map((item, batchIndex) =>
        handler(item, startIndex + batchIndex),
      ),
    );

    results.push(...batchResults);
  }

  return results;
}
