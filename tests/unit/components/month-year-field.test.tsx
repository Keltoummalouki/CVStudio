import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  EMPTY_MONTH_YEAR,
  MonthYearField,
  getMonthNames,
  getYearOptions,
  type MonthYearValue,
} from "@/components/forms/month-year-field";
import { MESSAGES, renderWithIntl } from "../../utils/render";

function Harness({ initial = EMPTY_MONTH_YEAR }: { initial?: MonthYearValue }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MonthYearField
        legend="Start date"
        value={value}
        onChange={setValue}
        minYear={2020}
        maxYear={2026}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const monthLabel = MESSAGES.en.dateField.month;
const yearLabel = MESSAGES.en.dateField.year;

describe("MonthYearField", () => {
  it("is a labelled group", () => {
    renderWithIntl(<Harness />);
    expect(screen.getByRole("group", { name: "Start date" })).toBeInTheDocument();
  });

  it("keeps the month unavailable until a year is chosen", async () => {
    renderWithIntl(<Harness />);
    expect(screen.getByLabelText(monthLabel)).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(yearLabel), "2025");
    expect(screen.getByLabelText(monthLabel)).toBeEnabled();
    expect(screen.getByTestId("value")).toHaveTextContent('{"year":2025,"month":null}');
  });

  it("supports month precision and year-only precision", async () => {
    renderWithIntl(<Harness initial={{ year: 2025, month: null }} />);

    await userEvent.selectOptions(screen.getByLabelText(monthLabel), "6");
    expect(screen.getByTestId("value")).toHaveTextContent('{"year":2025,"month":6}');

    await userEvent.selectOptions(screen.getByLabelText(monthLabel), "");
    expect(screen.getByTestId("value")).toHaveTextContent('{"year":2025,"month":null}');
  });

  it("clears the month when the year is cleared, never leaving a month without a year", async () => {
    renderWithIntl(<Harness initial={{ year: 2025, month: 2 }} />);
    await userEvent.selectOptions(screen.getByLabelText(yearLabel), "");
    expect(screen.getByTestId("value")).toHaveTextContent('{"year":null,"month":null}');
  });

  it("lists months in the interface language", () => {
    renderWithIntl(<Harness initial={{ year: 2025, month: null }} />, { locale: "fr" });
    expect(screen.getByRole("option", { name: "Février" })).toBeInTheDocument();
  });
});

describe("date helpers", () => {
  it("builds localized, capitalized month names without time-zone drift", () => {
    expect(getMonthNames("en")[0]).toBe("January");
    expect(getMonthNames("en")[11]).toBe("December");
    expect(getMonthNames("fr")[7]).toBe("Août");
  });

  it("lists years newest first", () => {
    expect(getYearOptions(2023, 2026)).toEqual([2026, 2025, 2024, 2023]);
  });
});
