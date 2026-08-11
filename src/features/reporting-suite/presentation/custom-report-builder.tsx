"use client";
import { useState } from "react";
export function CustomReportBuilder({
  sections,
  ownerOnly = false,
}: {
  sections: readonly {
    key: string;
    label: string;
    description: string;
    metrics: readonly {
      key: string;
      visibility: "internal" | "owner_safe" | "standard";
    }[];
    visibilities: readonly ("internal" | "owner_safe")[];
  }[];
  ownerOnly?: boolean;
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [visibility, setVisibility] = useState<"internal" | "owner_safe">(
    ownerOnly ? "owner_safe" : "internal",
  );
  const eligible = sections.filter((section) =>
    section.visibilities.includes(visibility),
  );
  const changeVisibility = (next: "internal" | "owner_safe") => {
    setVisibility(next);
    setSelected((current) =>
      current.filter((key) =>
        sections
          .find((section) => section.key === key)
          ?.visibilities.includes(next),
      ),
    );
  };
  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  const move = (index: number, offset: number) =>
    setSelected((current) => {
      const next = [...current],
        target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  return (
    <fieldset>
      <legend className="font-semibold">Approved sections</legend>
      <label className="mt-2 block">
        Visibility
        <select
          className="mt-1 w-full rounded-lg border p-3"
          name="visibility"
          value={visibility}
          onChange={(event) =>
            changeVisibility(event.target.value as "internal" | "owner_safe")
          }
          disabled={ownerOnly}
        >
          {!ownerOnly ? <option value="internal">Internal</option> : null}
          <option value="owner_safe">Owner safe</option>
        </select>
      </label>
      {ownerOnly ? (
        <input name="visibility" type="hidden" value="owner_safe" />
      ) : null}
      <p aria-live="polite" className="mt-2 text-sm">
        {visibility === "owner_safe"
          ? "Only owner-safe sections and metrics are available."
          : "Internal reporting content is available."}
      </p>
      <p className="text-sm text-stone-600">
        Choose sections and canonical metrics, then arrange them with the
        keyboard-accessible controls.
      </p>
      <p aria-live="polite" className="mt-2 text-sm font-medium">
        Review: {visibility.replace("_", " ")} · {selected.length} selected
        section{selected.length === 1 ? "" : "s"}
      </p>
      {selected.map((key) => (
        <input key={key} name="sectionKeys" type="hidden" value={key} />
      ))}
      <div className="mt-3 grid gap-3">
        {eligible.map((section) => {
          const active = selected.includes(section.key),
            order = selected.indexOf(section.key);
          return (
            <div className="rounded-xl border p-3" key={section.key}>
              <label className="flex gap-2">
                <input
                  checked={active}
                  onChange={() => toggle(section.key)}
                  type="checkbox"
                />
                <span>
                  <strong>{section.label}</strong>
                  <span className="block text-sm text-stone-600">
                    {section.description}
                  </span>
                </span>
              </label>
              {active ? (
                <div className="mt-3 pl-6">
                  <div className="flex gap-2">
                    <button
                      aria-label={`Move ${section.label} up`}
                      className="rounded border px-2 py-1 text-sm"
                      disabled={order === 0}
                      onClick={() => move(order, -1)}
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      aria-label={`Move ${section.label} down`}
                      className="rounded border px-2 py-1 text-sm"
                      disabled={order === selected.length - 1}
                      onClick={() => move(order, 1)}
                      type="button"
                    >
                      Move down
                    </button>
                  </div>
                  {section.metrics.filter(
                    (metric) =>
                      visibility !== "owner_safe" ||
                      metric.visibility === "owner_safe",
                  ).length ? (
                    <fieldset className="mt-3">
                      <legend className="text-sm font-semibold">Metrics</legend>
                      {section.metrics
                        .filter(
                          (metric) =>
                            visibility !== "owner_safe" ||
                            metric.visibility === "owner_safe",
                        )
                        .map(({ key }) => (
                          <label
                            className="mr-4 mt-2 inline-flex items-center gap-1 text-sm"
                            key={key}
                          >
                            <input
                              defaultChecked
                              name={`metricKeys:${section.key}`}
                              type="checkbox"
                              value={key}
                            />
                            {key.replaceAll("-", " ")}
                          </label>
                        ))}
                    </fieldset>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
