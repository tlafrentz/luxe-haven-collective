export function FieldError({ message }: { message?: string[] }) {
  return message?.[0] ? <p className="mt-1 text-xs text-red-300">{message[0]}</p> : null;
}

export function inputClass() {
  return "input-dark";
}

export function lines(value?: string[] | null) {
  return (value ?? []).join("\n");
}
