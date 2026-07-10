export type PropertyFormState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
};
