# Required RentCastClient addition

Add this interface near the existing client input types:

```ts
export interface RentCastValueEstimateInput {
  readonly address: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFootage?: number;
  readonly radiusMiles?: number;
  readonly compCount?: number;
}
```

Add this public method inside `RentCastClient`:

```ts
async requestValueEstimate<T>(
  input: RentCastValueEstimateInput,
): Promise<T> {
  const address =
    input.address.trim();

  if (!address) {
    throw new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .InvalidRequest,
      message:
        "A property address is required.",
    });
  }

  const url =
    new URL(
      `${this.baseUrl}/avm/value`,
    );

  url.searchParams.set(
    "address",
    address,
  );

  if (
    input.latitude !== undefined
  ) {
    url.searchParams.set(
      "latitude",
      String(input.latitude),
    );
  }

  if (
    input.longitude !== undefined
  ) {
    url.searchParams.set(
      "longitude",
      String(input.longitude),
    );
  }

  if (
    input.bedrooms !== undefined
  ) {
    url.searchParams.set(
      "bedrooms",
      String(input.bedrooms),
    );
  }

  if (
    input.bathrooms !== undefined
  ) {
    url.searchParams.set(
      "bathrooms",
      String(input.bathrooms),
    );
  }

  if (
    input.squareFootage !== undefined
  ) {
    url.searchParams.set(
      "squareFootage",
      String(input.squareFootage),
    );
  }

  if (
    input.radiusMiles !== undefined
  ) {
    url.searchParams.set(
      "maxRadius",
      String(input.radiusMiles),
    );
  }

  url.searchParams.set(
    "compCount",
    String(
      input.compCount ?? 10,
    ),
  );

  return this.request<T>(url);
}
```

Change the existing `request` method from `private` to `private` only if this method is added inside the class. No other visibility change is required.
