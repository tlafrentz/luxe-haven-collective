export interface Location {
  readonly address1: string;
  readonly address2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly latitude?: number;
  readonly longitude?: number;
}
